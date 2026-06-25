/**
 * Background deposit monitor — polls BSCScan every 60s for incoming USDT BEP20
 * deposits to the hot wallet address (bscAddress in system_settings).
 *
 * creditUserDeposit() is exported for use by the admin credit-missed endpoint.
 */

import { db } from "@workspace/db";
import {
  transactionsTable,
  walletsTable,
  depositVerificationsTable,
  systemSettingsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getBscScanUsdtTxs, rawBscToUsdt } from "./bsc.js";
import { logger } from "./logger.js";
import { PushNotify } from "../routes/push.js";

const POLL_INTERVAL_MS = 60_000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastBlock = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key));
  return rows[0]?.value?.trim() ?? "";
}

async function getProcessedTxIds(): Promise<Set<string>> {
  const [completedRows, reviewedRows] = await Promise.all([
    db
      .select({ txid: transactionsTable.txid })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "deposit"), isNotNull(transactionsTable.txid))),
    db.select({ txid: depositVerificationsTable.txid }).from(depositVerificationsTable),
  ]);
  const ids = new Set<string>();
  completedRows.forEach((r) => r.txid && ids.add(r.txid.toLowerCase()));
  reviewedRows.forEach((r) => ids.add(r.txid.toLowerCase()));
  return ids;
}

async function sendDepositEmail(
  userId: number,
  username: string,
  email: string,
  amount: string,
  txHash: string
): Promise<void> {
  try {
    const apiKey = await getSetting("brevoApiKey");
    if (!apiKey) return;
    const senderEmail = (await getSetting("brevoSenderEmail")) || "noreply@xendrx.com";
    const senderName = (await getSetting("brevoSenderName")) || "Xendrx";
    const date =
      new Date().toLocaleString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "UTC",
      }) + " UTC";
    const displayAmount = parseFloat(amount).toFixed(2);
    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0f1e;color:#fff;padding:30px;border-radius:12px;">
  <div style="text-align:center;margin-bottom:30px;"><img src="https://xendrx.com/src/assets/logo-banner.svg" height="40" alt="Xendrx"/></div>
  <h2 style="color:#00D4FF;text-align:center;">Deposit Confirmed ✅</h2>
  <p>Dear <strong>${username}</strong>,</p>
  <p>Your deposit has been successfully received and credited to your Xendrx wallet.</p>
  <div style="background:#1a2035;padding:20px;border-radius:8px;margin:20px 0;">
    <p>💰 <strong>Amount:</strong> ${displayAmount} USDT</p>
    <p>🔗 <strong>Transaction:</strong> ${txHash}</p>
    <p>📅 <strong>Date:</strong> ${date}</p>
    <p>✅ <strong>Status:</strong> Confirmed</p>
    <p>🌐 <strong>Network:</strong> BEP20 (BNB Smart Chain)</p>
  </div>
  <p>Your available balance has been updated. You can now start trading on Xendrx P2P.</p>
  <div style="text-align:center;margin:30px 0;">
    <a href="https://xendrx.com/wallet" style="background:#00D4FF;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">View Wallet</a>
  </div>
  <p style="color:#888;font-size:12px;text-align:center;">This is an automated message from Xendrx. Do not reply to this email.</p>
</div>`;
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: `✅ Deposit Confirmed — ${displayAmount} USDT Received`,
        htmlContent,
      }),
    });
    if (r.ok) {
      console.log(`[Deposit] Confirmation email sent to ${email} (user ${userId})`);
    } else {
      const body = await r.text().catch(() => "");
      console.warn(`[Deposit] Brevo email failed for user ${userId}: HTTP ${r.status} — ${body}`);
    }
  } catch (err) {
    console.warn("[Deposit] Email send error:", err);
  }
}

/**
 * Credit a user's wallet and fire push + email notifications.
 * Exported for use by admin credit-missed endpoint.
 */
export async function creditUserDeposit(
  userId: number,
  walletId: number,
  currentBalance: string,
  amountUsdt: string,
  tx: { txid: string; from: string; to: string },
): Promise<boolean> {
  const amountFloat = parseFloat(amountUsdt);
  const newBalance = (parseFloat(currentBalance) + amountFloat).toFixed(6);

  console.log(`[Deposit] Crediting user ${userId}: ${amountUsdt} USDT (txid: ${tx.txid})`);

  await db
    .update(walletsTable)
    .set({ availableBalance: newBalance, updatedAt: new Date() })
    .where(eq(walletsTable.id, walletId));

  await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amountUsdt,
    network: "BEP20",
    status: "completed",
    txid: tx.txid,
    address: tx.from,
  });

  await db
    .insert(depositVerificationsTable)
    .values({
      userId,
      txid: tx.txid,
      amount: amountUsdt,
      fromAddress: tx.from,
      toAddress: tx.to,
      network: "BEP20",
      status: "completed",
      source: "admin_manual",
      adminNote: `Manually credited by admin. ${amountUsdt} USDT from ${tx.from}`,
    })
    .onConflictDoNothing();

  PushNotify.depositReceived(userId, amountUsdt).catch((err) => {
    console.warn("[Deposit] Push notification failed:", err);
  });

  db.select({
    email: usersTable.email,
    emailVerified: usersTable.emailVerified,
    username: usersTable.username,
  })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then(([user]) => {
      if (user?.emailVerified && user.email) {
        sendDepositEmail(userId, user.username, user.email, amountUsdt, tx.txid).catch(() => {});
      }
    })
    .catch(() => {});

  return true;
}

// ── Poll ──────────────────────────────────────────────────────────────────────

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    const businessAddress = await getSetting("bscAddress");
    if (!businessAddress) {
      logger.debug("[Deposit] bscAddress not configured in system_settings — skipping poll");
      return;
    }

    const apiKey = (await getSetting("bscscanApiKey")) || "YourApiKeyToken";

    console.log(`[Deposit] Polling BSC address ${businessAddress} for new BEP20 USDT deposits`);

    let txs: Awaited<ReturnType<typeof getBscScanUsdtTxs>>;
    try {
      txs = await getBscScanUsdtTxs(businessAddress, lastBlock, apiKey);
    } catch (err) {
      logger.error({ err, address: businessAddress }, "Error fetching BEP20 transactions");
      return;
    }

    if (txs.length === 0) return;

    const processed = await getProcessedTxIds();

    for (const tx of txs) {
      // Track highest block seen so we don't re-check old ones
      const blockNum = parseInt(tx.blockNumber, 10);
      if (blockNum > lastBlock) lastBlock = blockNum;

      if (processed.has(tx.hash.toLowerCase())) continue;
      if (tx.to.toLowerCase() !== businessAddress.toLowerCase()) continue;

      const amountUsdt = rawBscToUsdt(tx.value);
      if (parseFloat(amountUsdt) <= 0) continue;

      console.log(
        `[Deposit] Detected unprocessed BEP20 deposit: ${amountUsdt} USDT from ${tx.from} (txHash: ${tx.hash})`
      );
    }
  } catch (err) {
    logger.error({ err }, "Deposit monitor poll error");
  } finally {
    isRunning = false;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function startDepositMonitor() {
  if (monitorInterval) return;
  logger.info(
    "Starting BEP20 deposit monitor — watching BSC address (60s interval)"
  );
  poll();
  monitorInterval = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopDepositMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("BEP20 deposit monitor stopped");
  }
}
