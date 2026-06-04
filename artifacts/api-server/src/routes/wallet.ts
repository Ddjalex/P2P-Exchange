import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, transactionsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sendUsdt, privateKeyToTronAddress, deriveUserDepositAddress, getTrc20TxDetails } from "../lib/tron.js";
import { depositVerificationsTable } from "@workspace/db";

const router = Router();

async function getSetting(key: string, fallback = ""): Promise<string> {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key));
  return rows[0]?.value ?? fallback;
}

async function getOrCreateWallet(userId: number) {
  const rows = await db.select().from(walletsTable).where(
    and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT"))
  );
  if (rows[0]) return rows[0];
  const [w] = await db.insert(walletsTable).values({
    userId,
    asset: "USDT",
    availableBalance: "0.00",
    frozenBalance: "0.00",
  }).returning();
  return w;
}

// GET /api/wallet
router.get("/", async (req, res) => {
  try {
    const wallet = await getOrCreateWallet((req as any).userId);
    const avail = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenBalance);
    const total = avail + frozen;
    const etbRate = await getSetting("etbRate", "0");
    const etbValue = (total * parseFloat(etbRate || "0")).toFixed(2);
    res.json({
      userId: wallet.userId,
      asset: wallet.asset,
      availableBalance: wallet.availableBalance,
      frozenBalance: wallet.frozenBalance,
      totalBalance: total.toFixed(2),
      etbValue,
      etbRate,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/deposit-address?network=TRC20
router.get("/deposit-address", async (req, res) => {
  const network = req.query.network as string;
  if (!["TRC20", "ERC20"].includes(network)) {
    return res.status(400).json({ error: "Invalid network" });
  }
  if (network === "ERC20") {
    return res.status(503).json({ error: "ERC20 deposits not yet supported. Use TRC20." });
  }

  try {
    // All users deposit to the business owner's single address (set in Admin → Settings)
    const settingKey = network === "TRC20" ? "trc20Address" : "erc20Address";
    const address = await getSetting(settingKey, "");
    if (!address) {
      return res.status(503).json({
        error: "Deposit address not configured yet. Please contact support.",
      });
    }
    const minDeposit = await getSetting("minDeposit", "1");
    res.json({ address, network, minDeposit });
  } catch (err) {
    req.log.error({ err }, "Failed to get deposit address");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/deposit/report — user reports a missed deposit by submitting their txid
router.post("/deposit/report", async (req, res) => {
  try {
    const { txid } = req.body;
    const userId = (req as any).userId;
    if (!txid || typeof txid !== "string" || txid.trim().length < 10) {
      return res.status(400).json({ error: "A valid transaction ID (txid) is required" });
    }
    const cleanTxid = txid.trim();

    // Check if already processed
    const already = await db.select().from(transactionsTable).where(
      and(eq(transactionsTable.txid, cleanTxid), eq(transactionsTable.type, "deposit"))
    );
    if (already.length > 0 && already[0].status === "completed") {
      return res.status(409).json({ error: "This transaction has already been credited to your wallet." });
    }

    // Check if already pending review
    const existingReview = await db.select().from(depositVerificationsTable).where(
      eq(depositVerificationsTable.txid, cleanTxid)
    );
    if (existingReview.length > 0) {
      return res.status(409).json({ error: "This transaction is already under review. Please wait for admin approval.", status: existingReview[0].status });
    }

    // Try to verify on-chain
    const details = await getTrc20TxDetails(cleanTxid).catch(() => null);

    // Get user's deposit address for cross-check
    const masterSeed = process.env["DEPOSIT_MASTER_SEED"];
    let depositAddress: string | null = null;
    if (masterSeed) {
      depositAddress = deriveUserDepositAddress(masterSeed, userId);
    }

    const [review] = await db.insert(depositVerificationsTable).values({
      userId,
      txid: cleanTxid,
      amount: details?.amount ?? null,
      fromAddress: details?.from ?? null,
      toAddress: details?.to ?? depositAddress,
      network: "TRC20",
      status: "pending",
      source: "user_report",
    }).returning();

    res.json({
      id: review.id,
      status: "pending",
      message: "Your deposit report has been submitted. An admin will review and credit your wallet within 24 hours.",
      amount: review.amount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to report deposit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/deposit/initiate — user registers their sending address so the monitor can auto-match
router.post("/deposit/initiate", async (req, res) => {
  try {
    const { amount, fromAddress } = req.body;
    const userId = (req as any).userId;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!fromAddress || typeof fromAddress !== "string" || fromAddress.trim().length < 10) {
      return res.status(400).json({ error: "Your sending wallet address (fromAddress) is required so we can automatically credit your deposit." });
    }

    const cleanFrom = fromAddress.trim();

    // Get the business deposit address to show the user
    const businessAddress = await getSetting("trc20Address", "");

    // Store as pending_match so the monitor can match this deposit when it arrives
    const [record] = await db.insert(depositVerificationsTable).values({
      userId,
      txid: `pending-${userId}-${Date.now()}`,
      amount: amt.toFixed(6),
      fromAddress: cleanFrom,
      toAddress: businessAddress || null,
      network: "TRC20",
      status: "pending_match",
      source: "user_report",
      adminNote: `User initiated deposit of ${amt.toFixed(6)} USDT from ${cleanFrom}`,
    }).returning();

    res.json({
      id: record.id,
      status: "pending_match",
      depositAddress: businessAddress,
      amount: amt.toFixed(6),
      fromAddress: cleanFrom,
      message: `Send exactly ${amt.toFixed(6)} USDT (TRC20) to the deposit address from ${cleanFrom}. Your balance will be credited automatically once the transaction is confirmed on-chain.`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to initiate deposit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/withdraw — real TRC20 blockchain withdrawal
router.post("/withdraw", async (req, res) => {
  try {
    const { address, network, amount } = req.body;
    const userId = (req as any).userId;

    if (!address || !amount) return res.status(400).json({ error: "Invalid input" });
    if (network !== "TRC20") return res.status(400).json({ error: "Only TRC20 withdrawals are supported" });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) return res.status(400).json({ error: "Minimum withdrawal is 1 USDT" });

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    if (amt > avail) return res.status(400).json({ error: "Insufficient balance" });

    // Validate destination address format (TRON addresses start with T, length 34)
    if (!address.startsWith("T") || address.length !== 34) {
      return res.status(400).json({ error: "Invalid TRON address format" });
    }

    const privateKey = process.env["HOT_WALLET_PRIVATE_KEY"];
    if (!privateKey) {
      return res.status(503).json({ error: "Withdrawal service not configured" });
    }

    // Check hot wallet has enough balance (optional sanity check)
    const fee = (amt * 0.001);
    const netAmount = amt - fee;

    // Deduct balance BEFORE broadcast to prevent double-spend
    const newBalance = (avail - amt).toFixed(6);
    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    // Create pending tx record
    const [tx] = await db.insert(transactionsTable).values({
      userId,
      type: "withdraw",
      amount: amt.toFixed(6),
      network: "TRC20",
      status: "pending",
      address,
      fee: fee.toFixed(6),
    }).returning();

    // Broadcast to blockchain (async — respond immediately, update tx after)
    sendUsdt(privateKey, address, netAmount)
      .then(async (txid) => {
        await db.update(transactionsTable)
          .set({ status: "completed", txid })
          .where(eq(transactionsTable.id, tx.id));
        req.log.info({ txid, userId, amount: netAmount }, "Withdrawal broadcast successful");
      })
      .catch(async (err) => {
        req.log.error({ err, txId: tx.id }, "Withdrawal broadcast failed — refunding");
        // Refund balance on failure
        const currentWallet = await getOrCreateWallet(userId);
        const refunded = (parseFloat(currentWallet.availableBalance) + amt).toFixed(6);
        await db.update(walletsTable)
          .set({ availableBalance: refunded, updatedAt: new Date() })
          .where(eq(walletsTable.id, wallet.id));
        await db.update(transactionsTable)
          .set({ status: "failed" })
          .where(eq(transactionsTable.id, tx.id));
      });

    res.json({
      id: tx.id,
      status: "pending",
      amount: amt.toFixed(6),
      netAmount: netAmount.toFixed(6),
      fee: fee.toFixed(6),
      network: "TRC20",
      address,
      message: "Withdrawal submitted to blockchain. Usually confirms within 1-3 minutes.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to withdraw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/transactions — transaction history
router.get("/transactions", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 100);
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit);

    res.json(rows.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      network: tx.network,
      status: tx.status,
      txid: tx.txid,
      address: tx.address,
      fee: tx.fee,
      createdAt: tx.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/hot-wallet-address — for admin info
router.get("/hot-wallet-info", async (req, res) => {
  try {
    const privateKey = process.env["HOT_WALLET_PRIVATE_KEY"];
    if (!privateKey) return res.status(503).json({ error: "Not configured" });
    const address = privateKeyToTronAddress(privateKey.replace(/^0x/, ""));
    res.json({ address, network: "TRC20" });
  } catch (err) {
    res.status(500).json({ error: "Failed to derive address" });
  }
});

export default router;
