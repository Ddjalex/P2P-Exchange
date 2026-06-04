/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to the business owner's single deposit address (Admin → Settings → trc20Address).
 *
 * All detected deposits are queued in deposit_verifications for the admin to review
 * and assign to the correct user via Admin → Deposits.
 */

import { db } from "@workspace/db";
import {
  transactionsTable,
  walletsTable,
  depositVerificationsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getTrc20Transactions, rawToUsdt } from "./tron.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 60_000;
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function getBusinessAddress(): Promise<string | null> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "trc20Address"));
  const addr = rows[0]?.value?.trim();
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

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    const businessAddress = await getBusinessAddress();
    if (!businessAddress) {
      logger.debug("No business TRC20 address configured in admin settings — skipping deposit poll");
      return;
    }

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

      // Queue every deposit for admin to assign to the correct user
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
          adminNote: "Incoming deposit detected on-chain. Assign to the correct user to credit their balance.",
        })
        .onConflictDoNothing();

      processed.add(tx.txid);
      logger.info(
        { txid: tx.txid, amountUsdt, fromAddress: tx.from },
        "Deposit detected — queued for admin assignment"
      );
    }
  } catch (err) {
    logger.error({ err }, "Deposit monitor poll error");
  } finally {
    isRunning = false;
  }
}

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
