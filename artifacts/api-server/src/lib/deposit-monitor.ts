/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to the business deposit address (Admin → Settings → trc20Address).
 *
 * Address is always read from system_settings so admin changes take effect
 * immediately without a server restart.
 *
 * For each new confirmed deposit:
 *  1. Matches the destination address against wallets.deposit_address to find the user
 *  2. If a unique user match is found → auto-credits their wallet balance
 *  3. Sends a push notification and Brevo confirmation email to verified users
 *  4. Falls back to admin queue when no unique user match can be made
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
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key));
  return rows[0]?.value?.trim() ?? "";
}

async function getBusinessAddress(): Promise<string | null> {
  const addr = await getSetting("trc20Address");
  return addr || null;
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
    if (!apiKey) {
      console.log("[Deposit] Brevo API key not configured — skipping email for user", userId);
      return;
    }
    const senderEmail = (await getSetting("brevoSenderEmail")) || "noreply@xendrx.com";
    const senderName = (await getSetting("brevoSenderName")) || "Xendrx";

    const date = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";

    const displayAmount = parseFloat(amount).toFixed(2);

    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f1e; color: #ffffff; padding: 30px; border-radius: 12px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://xendrx.com/src/assets/logo-banner.svg" height="40" alt="Xendrx" />
  </div>
  <h2 style="color: #00D4FF; text-align: center;">Deposit Confirmed ✅</h2>
  <p>Dear <strong>${username}</strong>,</p>
  <p>Your deposit has been successfully received and credited to your Xendrx wallet.</p>
  <div style="background: #1a2035; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p>💰 <strong>Amount:</strong> ${displayAmount} USDT</p>
    <p>🔗 <strong>Transaction:</strong> ${txHash}</p>
    <p>📅 <strong>Date:</strong> ${date}</p>
    <p>✅ <strong>Status:</strong> Confirmed</p>
  </div>
  <p>Your available balance has been updated. You can now start trading on Xendrx P2P.</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://xendrx.com/wallet" style="background: #00D4FF; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Wallet</a>
  </div>
  <p style="color: #888; font-size: 12px; text-align: center;">
    This is an automated message from Xendrx. Do not reply to this email.
  </p>
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

// ── Poll ──────────────────────────────────────────────────────────────────────

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    const businessAddress = await getBusinessAddress();
    if (!businessAddress) {
      logger.debug("No business TRC20 address configured in admin settings — skipping deposit poll");
      return;
    }

    console.log("[Deposit] Checking TRC20 transactions for address:", businessAddress);

    const processed = await getProcessedTxIds();
    const since = Date.now() - 24 * 60 * 60 * 1000;

    let txs: Awaited<ReturnType<typeof getTrc20Transactions>>;
    try {
      txs = await getTrc20Transactions(businessAddress, since);
    } catch (err) {
      logger.error({ err, businessAddress }, "Error fetching TRC20 transactions for business address");
      return;
    }

    for (const tx of txs) {
      if (!tx.confirmed) continue;
      if (processed.has(tx.txid)) continue;
      if (tx.to.toLowerCase() !== businessAddress.toLowerCase()) continue;

      const amountUsdt = rawToUsdt(tx.value);
      const amountFloat = parseFloat(amountUsdt);
      if (amountFloat <= 0) continue;

      // Try to match to a user by their assigned deposit address
      const matchingWallets = await db
        .select({
          userId: walletsTable.userId,
          walletId: walletsTable.id,
          balance: walletsTable.availableBalance,
        })
        .from(walletsTable)
        .where(eq(walletsTable.depositAddress, tx.to));

      if (matchingWallets.length === 1) {
        // ── Auto-credit ──────────────────────────────────────────────────────
        const { userId, walletId, balance } = matchingWallets[0];
        const newBalance = (parseFloat(balance) + amountFloat).toFixed(6);

        console.log(
          `[Deposit] Found new transaction: ${tx.txid} amount: ${amountUsdt} crediting user: ${userId}`
        );

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
            toAddress: businessAddress,
            network: "TRC20",
            status: "completed",
            source: "monitor_auto",
            adminNote: `Auto-credited by deposit monitor. ${amountUsdt} USDT from ${tx.from}`,
          })
          .onConflictDoNothing();

        // Push notification (fire-and-forget)
        PushNotify.depositReceived(userId, amountUsdt).catch((err) => {
          console.warn("[Deposit] Push notification failed:", err);
        });

        // Brevo email — only for users with a verified email address
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

      } else {
        // ── Queue for admin assignment ────────────────────────────────────────
        await db
          .insert(depositVerificationsTable)
          .values({
            userId: null,
            txid: tx.txid,
            amount: amountUsdt,
            fromAddress: tx.from,
            toAddress: businessAddress,
            network: "TRC20",
            status: "pending",
            source: "monitor_failure",
            adminNote:
              "Incoming deposit detected on-chain. Assign to the correct user to credit their balance.",
          })
          .onConflictDoNothing();

        logger.info(
          { txid: tx.txid, amountUsdt, fromAddress: tx.from, matchCount: matchingWallets.length },
          "Deposit detected — queued for admin assignment (no unique user match)"
        );
      }

      processed.add(tx.txid);
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
  logger.info("Starting TRC20 deposit monitor — watching business address (60s interval)");
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
