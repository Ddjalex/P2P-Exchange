import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, transactionsTable, systemSettingsTable, usersTable, internalTransfersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { sendUsdt, privateKeyToTronAddress, getTrc20TxDetails, getTrc20Balance } from "../lib/tron.js";
import { depositVerificationsTable } from "@workspace/db";
import { getBscUsdtTx } from "../lib/bsc.js";
import { emitToUser } from "../lib/sse.js";
import { getFeePercents } from "../helpers/fees.js";

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
    const [etbRate, minWithdrawal, { withdrawalFeeTRC20, withdrawalFeeERC20 }] = await Promise.all([
      getSetting("etbRate", "0"),
      getSetting("minWithdrawal", "10"),
      getFeePercents(),
    ]);
    const etbValue = (total * parseFloat(etbRate || "0")).toFixed(2);
    res.json({
      userId: wallet.userId,
      asset: wallet.asset,
      availableBalance: wallet.availableBalance,
      frozenBalance: wallet.frozenBalance,
      totalBalance: total.toFixed(2),
      etbValue,
      etbRate,
      minWithdrawal,
      withdrawalFeeTRC20,
      withdrawalFeeERC20,
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
    const minDeposit = await getSetting("minDeposit", "1");

    const settingKey = network === "BEP20" ? "bep20Address" : "trc20Address";
    const address = await getSetting(settingKey, "");

    if (!address) {
      return res.status(503).json({
        error: "Deposit address not configured yet. Please contact support.",
      });
    }

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
    const [minWithdrawalSetting, { withdrawalFeeTRC20 }] = await Promise.all([
      getSetting("minWithdrawal", "10").then(parseFloat),
      getFeePercents(),
    ]);
    if (isNaN(amt) || amt < minWithdrawalSetting) return res.status(400).json({ error: `Minimum withdrawal is ${minWithdrawalSetting} USDT` });

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

    const fee = withdrawalFeeTRC20;
    if (amt <= fee) return res.status(400).json({ error: `Amount must be greater than the withdrawal fee (${fee} USDT)` });
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

    // Check hot wallet USDT balance before broadcasting.
    // If insufficient, leave as "pending" for admin to manually process — never attempt
    // a doomed on-chain transaction that wastes energy and confuses the user.
    let hotWalletBalance = 0;
    try {
      const hotAddress = privateKeyToTronAddress(privateKey.replace(/^0x/, ""));
      const balStr = await getTrc20Balance(hotAddress);
      hotWalletBalance = parseFloat(balStr);
    } catch (balErr) {
      req.log.warn({ balErr }, "Could not fetch hot wallet balance — proceeding with caution");
    }

    if (hotWalletBalance < netAmount) {
      // Insufficient hot wallet funds — hold for admin approval
      req.log.warn(
        { hotWalletBalance, netAmount, txId: tx.id },
        "Hot wallet insufficient — withdrawal held pending admin approval"
      );
      res.json({
        id: tx.id,
        status: "pending",
        amount: amt.toFixed(6),
        netAmount: netAmount.toFixed(6),
        fee: fee.toFixed(6),
        network: "TRC20",
        address,
        message: "Withdrawal is pending admin approval. You will be notified once processed.",
      });
      return;
    }

    // Broadcast to blockchain — fire and forget.
    // On success: mark completed. On failure: leave as "pending" for admin review.
    // Never auto-refund — admin manually approves or rejects via the admin panel.
    sendUsdt(privateKey, address, netAmount)
      .then(async (txid) => {
        await db.update(transactionsTable)
          .set({ status: "completed", txid })
          .where(eq(transactionsTable.id, tx.id));
        req.log.info({ txid, userId, amount: netAmount }, "Withdrawal broadcast successful");
      })
      .catch(async (err) => {
        req.log.error({ err, txId: tx.id }, "Withdrawal broadcast failed — leaving pending for admin review");
        await db.update(transactionsTable)
          .set({ status: "pending" })
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

// GET /api/wallet/find-user — find a user by UID, email, or phone for internal transfer
router.get("/find-user", async (req, res) => {
  try {
    const { identifier, type } = req.query as { identifier?: string; type?: string };
    const userId = (req as any).userId;

    if (!identifier || !type || !["uid", "email", "phone"].includes(type)) {
      return res.status(400).json({ message: "identifier and type (uid|email|phone) required" });
    }

    let user: any;
    if (type === "uid") {
      user = await db.select().from(usersTable).where(eq(usersTable.uid, identifier)).then(r => r[0]);
    } else if (type === "email") {
      user = await db.select().from(usersTable).where(eq(usersTable.email, identifier.toLowerCase())).then(r => r[0]);
    } else {
      user = await db.select().from(usersTable).where(eq(usersTable.phone, identifier)).then(r => r[0]);
    }

    if (!user) return res.status(404).json({ message: "User not found on Xendrx" });
    if (user.id === userId) return res.status(400).json({ message: "Cannot transfer to yourself" });

    const name = user.username || "";
    const displayName = name.length <= 4
      ? name[0] + "***"
      : name.slice(0, 2) + "***" + name.slice(-2);

    return res.json({ found: true, user: { uid: user.uid, username: user.username, displayName } });
  } catch (err) {
    req.log.error({ err }, "find-user error");
    return res.status(500).json({ message: "Search failed" });
  }
});

// POST /api/wallet/internal-transfer — zero-fee transfer between Xendrx users
router.post("/internal-transfer", async (req, res) => {
  try {
    const senderId = (req as any).userId;
    const { identifier, identifierType, amount, note } = req.body;

    if (!identifier || !identifierType || !amount) {
      return res.status(400).json({ message: "All fields required" });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({ message: "Minimum transfer is 1 USDT" });
    }

    const sender = await db.select().from(usersTable).where(eq(usersTable.id, senderId)).then(r => r[0]);
    if (!sender) return res.status(401).json({ message: "Unauthorized" });

    let receiver: any;
    if (identifierType === "uid") {
      receiver = await db.select().from(usersTable).where(eq(usersTable.uid, identifier)).then(r => r[0]);
    } else if (identifierType === "email") {
      receiver = await db.select().from(usersTable).where(eq(usersTable.email, identifier.toLowerCase())).then(r => r[0]);
    } else {
      receiver = await db.select().from(usersTable).where(eq(usersTable.phone, identifier)).then(r => r[0]);
    }

    if (!receiver) return res.status(404).json({ message: "Recipient not found on Xendrx" });
    if (receiver.id === senderId) return res.status(400).json({ message: "Cannot transfer to yourself" });

    const senderWallet = await getOrCreateWallet(senderId);
    const senderAvail = parseFloat(senderWallet.availableBalance);

    if (senderAvail < transferAmount) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ${senderAvail.toFixed(4)} USDT`,
      });
    }

    const receiverWallet = await getOrCreateWallet(receiver.id);

    const newSenderBalance = (senderAvail - transferAmount).toFixed(6);
    const newReceiverBalance = (parseFloat(receiverWallet.availableBalance) + transferAmount).toFixed(6);

    await db.transaction(async (tx) => {
      await tx.update(walletsTable)
        .set({ availableBalance: newSenderBalance })
        .where(eq(walletsTable.id, senderWallet.id));

      await tx.update(walletsTable)
        .set({ availableBalance: newReceiverBalance })
        .where(eq(walletsTable.id, receiverWallet.id));

      await tx.insert(internalTransfersTable).values({
        senderId,
        receiverId: receiver.id,
        amount: transferAmount.toFixed(6),
        note: note || null,
        status: "completed",
      });

      await tx.insert(transactionsTable).values([
        {
          userId: senderId,
          type: "internal_send",
          amount: transferAmount.toFixed(6),
          status: "completed",
          note: `Internal transfer to ${receiver.username} (UID: ${receiver.uid ?? "—"})`,
        },
        {
          userId: receiver.id,
          type: "internal_receive",
          amount: transferAmount.toFixed(6),
          status: "completed",
          note: `Internal transfer from ${sender.username} (UID: ${sender.uid ?? "—"})`,
        },
      ]);

      await tx.insert(notificationsTable).values({
        userId: receiver.id,
        type: "internal_receive",
        title: "💸 USDT Received",
        message: `${transferAmount.toFixed(4)} USDT received from ${sender.username}`,
      });
    });

    // Push real-time wallet balance update to both parties
    emitToUser(senderId, "wallet_update", {});
    emitToUser(receiver.id, "wallet_update", {});

    const receiverName = (receiver.username || "").length <= 4
      ? (receiver.username || "")[0] + "***"
      : (receiver.username || "").slice(0, 2) + "***" + (receiver.username || "").slice(-2);

    return res.json({
      success: true,
      message: `${transferAmount.toFixed(4)} USDT sent to ${receiverName} successfully!`,
    });
  } catch (err) {
    req.log.error({ err }, "internal-transfer error");
    return res.status(500).json({ message: "Transfer failed. Please try again." });
  }
});

// GET /api/wallet/transfer-history — list of internal transfers for current user
router.get("/transfer-history", async (req, res) => {
  try {
    const userId = (req as any).userId;

    const transfers = await db.select().from(internalTransfersTable)
      .where(or(eq(internalTransfersTable.senderId, userId), eq(internalTransfersTable.receiverId, userId)))
      .orderBy(desc(internalTransfersTable.createdAt))
      .limit(50);

    const enriched = await Promise.all(transfers.map(async (t) => {
      const [sender, receiver] = await Promise.all([
        db.select({ username: usersTable.username, uid: usersTable.uid }).from(usersTable).where(eq(usersTable.id, t.senderId)).then(r => r[0]),
        db.select({ username: usersTable.username, uid: usersTable.uid }).from(usersTable).where(eq(usersTable.id, t.receiverId)).then(r => r[0]),
      ]);
      return {
        ...t,
        isSender: t.senderId === userId,
        senderUsername: sender?.username,
        senderUid: sender?.uid,
        receiverUsername: receiver?.username,
        receiverUid: receiver?.uid,
      };
    }));

    return res.json({ transfers: enriched });
  } catch (err) {
    req.log.error({ err }, "transfer-history error");
    return res.status(500).json({ message: "Failed to fetch history" });
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
