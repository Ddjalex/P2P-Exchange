import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, transactionsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sendUsdt, privateKeyToTronAddress, getTrc20TxDetails } from "../lib/tron.js";
import { depositVerificationsTable } from "@workspace/db";
import { getBscUsdtTx } from "../lib/bsc.js";

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

// GET /api/wallet/deposit-address?network=TRC20|BEP20
router.get("/deposit-address", async (req, res) => {
  const network = (req.query.network as string)?.toUpperCase();
  if (!["TRC20", "BEP20"].includes(network)) {
    return res.status(400).json({ error: "Invalid network. Supported: TRC20, BEP20" });
  }

  try {
    const settingKey = network === "BEP20" ? "bep20Address" : "trc20Address";
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

// POST /api/wallet/deposit/verify — user submits TX hash; backend verifies on-chain and credits instantly
router.post("/deposit/verify", async (req, res) => {
  try {
    const { txHash, network } = req.body;
    const userId = (req as any).userId;

    if (!txHash || typeof txHash !== "string" || txHash.trim().length < 10) {
      return res.status(400).json({ error: "A valid transaction hash is required." });
    }
    if (network && !["TRC20", "BEP20", "AUTO"].includes((network as string).toUpperCase())) {
      return res.status(400).json({ error: "Network must be TRC20, BEP20, or AUTO." });
    }

    const cleanHash = txHash.trim();

    // Auto-detect network from hash format if not specified or "AUTO"
    const rawNet = (network as string).toUpperCase();
    let net: string;
    if (!rawNet || rawNet === "AUTO") {
      if (/^0x[0-9a-fA-F]{64}$/.test(cleanHash)) net = "BEP20";
      else if (/^[0-9a-fA-F]{64}$/.test(cleanHash)) net = "TRC20";
      else return res.status(400).json({ error: "Could not detect network from this hash. Select TRC20 or BEP20 manually." });
    } else {
      net = rawNet;
    }

    // Check if this TX has already been credited
    const [existingTx, existingVerif] = await Promise.all([
      db.select().from(transactionsTable).where(
        and(eq(transactionsTable.txid, cleanHash), eq(transactionsTable.type, "deposit"))
      ),
      db.select().from(depositVerificationsTable).where(
        eq(depositVerificationsTable.txid, cleanHash)
      ),
    ]);

    if (existingTx.length > 0 && existingTx[0].status === "completed") {
      return res.status(409).json({ error: "This transaction has already been credited to a wallet." });
    }
    if (existingVerif.length > 0 && existingVerif[0].status === "completed") {
      return res.status(409).json({ error: "This transaction has already been processed." });
    }

    // Get the business deposit address for this network
    const settingKey = net === "BEP20" ? "bep20Address" : "trc20Address";
    const businessAddress = await getSetting(settingKey);
    if (!businessAddress) {
      return res.status(503).json({ error: `${net} deposit address not configured. Please contact support.` });
    }

    // Read TronGrid API key — DB setting takes priority, env var as fallback
    // BEP20 uses free public BSC RPC — no key needed
    const trongridKey = await getSetting("trongridApiKey");

    // Verify transaction on the blockchain
    let txDetails: { confirmed: boolean; from: string; to: string; amount: string } | null = null;

    if (net === "BEP20") {
      txDetails = await getBscUsdtTx(cleanHash).catch(() => null);
    } else {
      const tron = await getTrc20TxDetails(cleanHash, trongridKey || undefined).catch(() => null);
      if (tron) {
        txDetails = {
          confirmed: tron.confirmed ?? true,
          from: tron.from,
          to: tron.to,
          amount: tron.amount,
        };
      }
    }

    if (!txDetails) {
      return res.status(422).json({
        error: "Transaction not found on blockchain. Make sure the TX hash is correct and matches the selected network.",
      });
    }
    if (!txDetails.confirmed) {
      return res.status(422).json({
        error: "Transaction is not confirmed yet. Please wait a minute and try again.",
      });
    }

    // Verify the USDT was sent TO our business address
    if (txDetails.to.toLowerCase() !== businessAddress.toLowerCase()) {
      return res.status(422).json({
        error: "This transaction was not sent to our deposit address. Please check you selected the correct network.",
      });
    }

    const amount = parseFloat(txDetails.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(422).json({ error: "Invalid amount in transaction." });
    }

    // Credit the user's wallet
    const wallet = await getOrCreateWallet(userId);
    const newBalance = (parseFloat(wallet.availableBalance) + amount).toFixed(6);

    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    // Record in transactions
    await db.insert(transactionsTable).values({
      userId,
      type: "deposit",
      amount: txDetails.amount,
      network: net,
      status: "completed",
      txid: cleanHash,
      address: txDetails.from,
    });

    // Record in deposit_verifications for admin audit trail
    await db.insert(depositVerificationsTable).values({
      userId,
      txid: cleanHash,
      amount: txDetails.amount,
      fromAddress: txDetails.from,
      toAddress: businessAddress,
      network: net,
      status: "completed",
      source: "user_verify",
      adminNote: `Auto-credited via user TX hash verification. ${txDetails.amount} USDT from ${txDetails.from}`,
    }).onConflictDoNothing();

    req.log.info({ userId, txHash: cleanHash, amount: txDetails.amount, net }, "Deposit verified and credited");

    res.json({
      success: true,
      amount: txDetails.amount,
      network: net,
      message: `${parseFloat(txDetails.amount).toFixed(2)} USDT has been added to your wallet!`,
    });
  } catch (err) {
    req.log.error({ err }, "Deposit verify error");
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

    // Broadcast to blockchain
    sendUsdt(privateKey, address, netAmount)
      .then(async (txid) => {
        await db.update(transactionsTable)
          .set({ status: "completed", txid })
          .where(eq(transactionsTable.id, tx.id));
        req.log.info({ txid, userId, amount: netAmount }, "Withdrawal broadcast successful");
      })
      .catch(async (err) => {
        req.log.error({ err, txId: tx.id }, "Withdrawal broadcast failed — refunding");
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

// GET /api/wallet/hot-wallet-info — for admin info
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
