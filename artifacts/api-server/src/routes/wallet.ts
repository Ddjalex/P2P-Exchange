import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { walletsTable, transactionsTable, systemSettingsTable, usersTable, internalTransfersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { depositVerificationsTable } from "@workspace/db";
import { getBscUsdtTx, getBscUsdtBalance, sendUsdtBsc } from "../lib/bsc.js";
import { emitToUser } from "../lib/sse.js";
import { getFeePercents } from "../helpers/fees.js";
import { deriveDepositAddress, isHdConfigured } from "../lib/bsc-hd.js";
import { checkVelocity, checkBalance, checkDailyLimit, checkWithdrawalAddress, auditLog } from "../middleware/security.js";

const router = Router();

// ─── In-memory rate limiter for withdrawal password confirmation ──────────────
// Max 5 failed attempts per user per 15 minutes. Resets on success.
const pwFailures = new Map<number, { count: number; resetAt: number }>();
const PW_MAX_ATTEMPTS = 5;
const PW_WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkPwRateLimit(userId: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = pwFailures.get(userId);
  if (!entry || now > entry.resetAt) return { allowed: true };
  if (entry.count >= PW_MAX_ATTEMPTS) return { allowed: false, retryAfterMs: entry.resetAt - now };
  return { allowed: true };
}
function recordPwFailure(userId: number) {
  const now = Date.now();
  const entry = pwFailures.get(userId);
  if (!entry || now > entry.resetAt) {
    pwFailures.set(userId, { count: 1, resetAt: now + PW_WINDOW_MS });
  } else {
    entry.count++;
  }
}
function clearPwFailures(userId: number) { pwFailures.delete(userId); }

async function verifyWithdrawPassword(userId: number, password: unknown): Promise<{ ok: boolean; error?: string }> {
  const rl = checkPwRateLimit(userId);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterMs ?? PW_WINDOW_MS) / 60000);
    return { ok: false, error: `Too many incorrect attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.` };
  }
  const row = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, userId)).then(r => r[0]);
  if (!row?.passwordHash) return { ok: false, error: "Account configuration error. Please contact support." };
  const match = await bcrypt.compare(String(password ?? ""), row.passwordHash).catch(() => false);
  if (!match) { recordPwFailure(userId); return { ok: false, error: "Incorrect password. Please try again." }; }
  clearPwFailures(userId);
  return { ok: true };
}

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
    const [etbRate, minWithdrawal, { withdrawalFeeBEP20 }] = await Promise.all([
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
      withdrawalFeeBEP20,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/deposit-address?network=BEP20
router.get("/deposit-address", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const minDeposit = await getSetting("minDeposit", "1");

    if (isHdConfigured()) {
      // Per-user HD address mode: derive unique address for this user
      const wallet = await getOrCreateWallet(userId);

      const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;
      let depositAddress = wallet.depositAddress;

      // Re-derive if missing or if a stale non-EVM (Tron/Base58) address is stored
      if (!depositAddress || !EVM_ADDRESS_RE.test(depositAddress)) {
        depositAddress = deriveDepositAddress(userId);
        await db
          .update(walletsTable)
          .set({ depositAddress, updatedAt: new Date() })
          .where(eq(walletsTable.id, wallet.id));
      }

      return res.json({ address: depositAddress, network: "BEP20", minDeposit });
    }

    // Legacy fallback: single hot-wallet address from system_settings
    const address = await getSetting("bscAddress", "");
    if (!address) {
      return res.status(503).json({
        error: "Deposit address not configured yet. Please contact support.",
      });
    }
    res.json({ address, network: "BEP20", minDeposit });
  } catch (err) {
    req.log.error({ err }, "Failed to get deposit address");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/deposit/verify — user submits BEP20 TX hash; backend verifies on-chain and credits instantly
router.post("/deposit/verify", async (req, res) => {
  try {
    const { txHash } = req.body;
    const userId = (req as any).userId;

    if (!txHash || typeof txHash !== "string" || txHash.trim().length < 10) {
      return res.status(400).json({ error: "A valid transaction hash is required." });
    }

    const cleanHash = txHash.trim();

    if (!/^0x[0-9a-fA-F]{64}$/.test(cleanHash)) {
      return res.status(400).json({ error: "Invalid BEP20 transaction hash format. It must start with 0x and be 66 characters long." });
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

    // Get the BSC hot wallet address
    const businessAddress = await getSetting("bscAddress");
    if (!businessAddress) {
      return res.status(503).json({ error: "BEP20 deposit address not configured. Please contact support." });
    }

    // Verify transaction on BSC
    const txDetails = await getBscUsdtTx(cleanHash).catch(() => null);

    if (!txDetails) {
      return res.status(422).json({
        error: "Transaction not found on BSC. Make sure the TX hash is correct and uses the BEP20 (BSC) network.",
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
        error: "This transaction was not sent to our deposit address. Make sure you are using the BEP20 (BSC) network.",
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
      network: "BEP20",
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
      network: "BEP20",
      status: "completed",
      source: "user_verify",
      adminNote: `Auto-credited via user TX hash verification. ${txDetails.amount} USDT from ${txDetails.from}`,
    }).onConflictDoNothing();

    req.log.info({ userId, txHash: cleanHash, amount: txDetails.amount }, "BEP20 deposit verified and credited");

    res.json({
      success: true,
      amount: txDetails.amount,
      network: "BEP20",
      message: `${parseFloat(txDetails.amount).toFixed(2)} USDT has been added to your wallet!`,
    });
  } catch (err) {
    req.log.error({ err }, "Deposit verify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/withdraw — BEP20 blockchain withdrawal
router.post("/withdraw", async (req, res) => {
  try {
    const { address, network, amount, password } = req.body;
    const userId = (req as any).userId;

    if (!address || !amount) return res.status(400).json({ error: "Invalid input" });
    if (network && network !== "BEP20") return res.status(400).json({ error: "Only BEP20 (BSC) withdrawals are supported" });

    // Password confirmation required
    if (!password) return res.status(400).json({ error: "Password is required to confirm withdrawal" });
    const pwCheck = await verifyWithdrawPassword(userId, password);
    if (!pwCheck.ok) return res.status(401).json({ error: pwCheck.error });

    // Check withdrawal suspension (separate from account freeze/ban)
    const userRecord = await db.select({ withdrawalSuspended: usersTable.withdrawalSuspended })
      .from(usersTable).where(eq(usersTable.id, userId)).then(r => r[0]);
    if (userRecord?.withdrawalSuspended) {
      return res.status(403).json({
        error: "Withdrawals are currently unavailable for your account.",
        code: "withdrawal_suspended",
      });
    }

    // Validate BSC address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid BEP20 address format. Must start with 0x and be 42 characters." });
    }

    const amt = parseFloat(amount);
    const [minWithdrawalSetting, { withdrawalFeeBEP20 }] = await Promise.all([
      getSetting("minWithdrawal", "10").then(parseFloat),
      getFeePercents(),
    ]);
    if (isNaN(amt) || amt < minWithdrawalSetting) return res.status(400).json({ error: `Minimum withdrawal is ${minWithdrawalSetting} USDT` });

    // Security checks
    const [velocity, balCheck, dailyCheck, addrCheck] = await Promise.all([
      checkVelocity(userId),
      checkBalance(userId, amt, "withdraw"),
      checkDailyLimit(userId, "withdraw", amt),
      checkWithdrawalAddress(userId, address),
    ]);
    if (!velocity.allowed) return res.status(429).json({ error: velocity.reason });
    if (!balCheck.allowed) return res.status(400).json({ error: balCheck.reason });
    if (!dailyCheck.allowed) return res.status(400).json({ error: dailyCheck.reason });
    if (!addrCheck.allowed) return res.status(400).json({ error: addrCheck.reason });

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    if (amt > avail) return res.status(400).json({ error: "Insufficient balance" });

    const privateKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
    if (!privateKey) {
      return res.status(503).json({ error: "Withdrawal service not configured" });
    }

    const fee = withdrawalFeeBEP20;
    if (amt <= fee) return res.status(400).json({ error: `Amount must be greater than the withdrawal fee (${fee} USDT)` });
    const netAmount = amt - fee;

    // Deduct user balance BEFORE broadcast to prevent double-spend
    const newBalance = (avail - amt).toFixed(6);
    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    // Create pending tx record
    const [tx] = await db.insert(transactionsTable).values({
      userId,
      type: "withdraw",
      amount: amt.toFixed(6),
      network: "BEP20",
      status: "pending",
      address,
      fee: fee.toFixed(6),
    }).returning();

    auditLog(userId, "WITHDRAWAL", { amount: amt, address, fee, txId: tx.id }, req);

    // Check hot wallet balance. If sufficient → auto-broadcast now.
    // If insufficient or unreachable → leave as "pending" for admin to approve manually.
    let hotWalletBalance = 0;
    let hotBalanceFetched = false;
    try {
      const { ethers } = await import("ethers");
      const hotWallet = new ethers.Wallet(privateKey);
      const balStr = await getBscUsdtBalance(hotWallet.address);
      hotWalletBalance = parseFloat(balStr);
      hotBalanceFetched = true;
    } catch (balErr) {
      req.log.warn({ balErr, txId: tx.id }, "Could not fetch BSC hot wallet balance — withdrawal held for admin approval");
    }

    if (hotBalanceFetched && hotWalletBalance >= netAmount) {
      sendUsdtBsc(privateKey, address, netAmount)
        .then(async (txid) => {
          await db.update(transactionsTable)
            .set({ status: "completed", txid })
            .where(eq(transactionsTable.id, tx.id));
          req.log.info({ txid, userId, amount: netAmount }, "BSC withdrawal broadcast successful");
        })
        .catch(async (err) => {
          req.log.error({ err, txId: tx.id }, "BSC withdrawal broadcast failed — leaving pending for admin review");
        });

      return res.json({
        id: tx.id,
        status: "pending",
        amount: amt.toFixed(6),
        netAmount: netAmount.toFixed(6),
        fee: fee.toFixed(6),
        network: "BEP20",
        address,
        message: "Withdrawal submitted. Usually confirms within 1-3 minutes.",
      });
    }

    req.log.warn({ hotWalletBalance, hotBalanceFetched, netAmount, txId: tx.id },
      "BSC hot wallet insufficient or unreachable — withdrawal held pending admin approval");

    res.json({
      id: tx.id,
      status: "pending",
      amount: amt.toFixed(6),
      netAmount: netAmount.toFixed(6),
      fee: fee.toFixed(6),
      network: "BEP20",
      address,
      message: "Withdrawal received and is pending admin approval. You will be notified once processed.",
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
    const { identifier, identifierType, amount, note, password } = req.body;

    if (!identifier || !identifierType || !amount) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Password confirmation required
    if (!password) return res.status(400).json({ message: "Password is required to confirm transfer" });
    const pwCheck = await verifyWithdrawPassword(senderId, password);
    if (!pwCheck.ok) return res.status(401).json({ message: pwCheck.error });

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({ message: "Minimum transfer is 1 USDT" });
    }

    // Security checks
    const [velocity, balCheck, dailyCheck] = await Promise.all([
      checkVelocity(senderId),
      checkBalance(senderId, transferAmount, "internal-transfer"),
      checkDailyLimit(senderId, "internal_send", transferAmount),
    ]);
    if (!velocity.allowed) return res.status(429).json({ message: velocity.reason });
    if (!balCheck.allowed) return res.status(400).json({ message: balCheck.reason });
    if (!dailyCheck.allowed) return res.status(400).json({ message: dailyCheck.reason });

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

    auditLog(senderId, "INTERNAL_TRANSFER", { amount: transferAmount, receiverId: receiver.id, receiverUsername: receiver.username }, req);

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
    const privateKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
    if (!privateKey) return res.status(503).json({ error: "Not configured" });
    const { ethers } = await import("ethers");
    const hotWallet = new ethers.Wallet(privateKey);
    res.json({ address: hotWallet.address, network: "BEP20" });
  } catch (err) {
    res.status(500).json({ error: "Failed to derive address" });
  }
});

export default router;
