/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to the ONE shared business address (trc20Address in system_settings).
 *
 * This monitor does NOT auto-credit users because all users share one address
 * and ownership cannot be determined automatically.
 *
 * Crediting happens in two ways:
 *   1. User pastes TX hash → POST /api/wallet/deposit/verify (instant)
 *   2. Admin manually credits → POST /api/admin/deposits/credit-missed
 *
 * The monitor logs every new detected deposit so admins can see incoming funds
 * in server logs and cross-reference with user-submitted verifications.
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
import { getTrc20Transactions, rawToUsdt } from "./tron.js";
import { logger } from "./logger.js";
import { PushNotify } from "../routes/push.js";

const POLL_INTERVAL_MS = 60_000;
const POLL_OVERLAP_MS = 30_000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastChecked: number | null = null;

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
  completedRows.forEach((r) => r.txid && ids.add(r.txid));
  reviewedRows.forEach((r) => ids.add(r.txid));
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
    network: "TRC20",
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
      network: "TRC20",
      status: "completed",
      source: "admin_manual",
      adminNote: `Manually credited by admin. ${amountUsdt} USDT from ${tx.from}`,
    })
    .onConflictDoNothing();

  // Push notification (fire-and-forget)
  PushNotify.depositReceived(userId, amountUsdt).catch((err) => {
    console.warn("[Deposit] Push notification failed:", err);
  });

  // Brevo email — only to verified email users
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
    const businessAddress = await getSetting("trc20Address");
    if (!businessAddress) {
      logger.debug("[Deposit] trc20Address not configured in system_settings — skipping poll");
      return;
    }

    const since = lastChecked
      ? lastChecked - POLL_OVERLAP_MS
      : Date.now() - 24 * 60 * 60 * 1000;

    console.log(`[Deposit] Polling business address ${businessAddress} for new TRC20 deposits`);

    let txs: Awaited<ReturnType<typeof getTrc20Transactions>>;
    try {
      txs = await getTrc20Transactions(businessAddress, since);
    } catch (err) {
      logger.error({ err, address: businessAddress }, "Error fetching TRC20 transactions");
      return;
    }

    lastChecked = Date.now();

    if (txs.length === 0) return;

    const processed = await getProcessedTxIds();

    for (const tx of txs) {
      if (!tx.confirmed) continue;
      if (processed.has(tx.txid)) continue;
      if (tx.to.toLowerCase() !== businessAddress.toLowerCase()) continue;

      const amountUsdt = rawToUsdt(tx.value);
      if (parseFloat(amountUsdt) <= 0) continue;

      // Log detected deposit so admins can see it in server logs.
      // Actual crediting requires user TX hash verification or admin manual credit.
      console.log(
        `[Deposit] Detected unprocessed deposit: ${amountUsdt} USDT from ${tx.from} (txid: ${tx.txid})`
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
    "Starting TRC20 deposit monitor — watching business address (60s interval)"
  );
  poll();
  monitorInterval = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopDepositMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("TRC20 deposit monitor stopped");
  }
}
