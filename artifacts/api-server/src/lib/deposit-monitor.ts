/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to the business owner's single deposit address (Admin → Settings → trc20Address).
 *
 * Matching logic:
 *  1. User initiates a deposit via POST /api/wallet/deposit/initiate (provides their sending address)
 *     → stored in deposit_verifications with status="pending_match"
 *  2. Monitor detects TX to business address, matches by fromAddress → auto-credits user
 *  3. If no match found → queued as "pending" for admin to assign manually
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

async function creditDeposit(userId: number, amountUsdt: string, txid: string, network: string) {
  let walletRows = await db
    .select()
    .from(walletsTable)
    .where(and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT")));
  let wallet = walletRows[0];
  if (!wallet) {
    const [w] = await db
      .insert(walletsTable)
      .values({ userId, asset: "USDT", availableBalance: "0.00", frozenBalance: "0.00" })
      .returning();
    wallet = w;
  }
  const newBalance = (parseFloat(wallet.availableBalance) + parseFloat(amountUsdt)).toFixed(6);
  await db
    .update(walletsTable)
    .set({ availableBalance: newBalance, updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amountUsdt,
    network,
    status: "completed",
    txid,
  });
  logger.info({ userId, amountUsdt, txid }, "Deposit auto-credited");
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

    // Load all pending_match records for matching
    const pendingMatches = await db
      .select()
      .from(depositVerificationsTable)
      .where(
        and(
          eq(depositVerificationsTable.status, "pending_match"),
          isNotNull(depositVerificationsTable.fromAddress)
        )
      );

    for (const tx of txs) {
      if (!tx.confirmed) continue;
      if (processed.has(tx.txid)) continue;
      if (tx.to.toLowerCase() !== businessAddress.toLowerCase()) continue;

      const amountUsdt = rawToUsdt(tx.value);
      const amountFloat = parseFloat(amountUsdt);
      if (amountFloat <= 0) continue;

      // Match by fromAddress
      const matched = pendingMatches.find(
        (r) =>
          r.fromAddress?.toLowerCase() === tx.from.toLowerCase() && r.userId !== null
      );

      if (matched && matched.userId !== null) {
        try {
          await creditDeposit(matched.userId, amountUsdt, tx.txid, "TRC20");
          await db
            .update(depositVerificationsTable)
            .set({
              status: "approved",
              txid: tx.txid,
              amount: amountUsdt,
              toAddress: businessAddress,
              reviewedAt: new Date(),
              reviewedBy: "auto-monitor",
              adminNote: "Auto-credited by deposit monitor — sender address matched",
            })
            .where(eq(depositVerificationsTable.id, matched.id));
          processed.add(tx.txid);
          logger.info(
            { userId: matched.userId, amountUsdt, txid: tx.txid, fromAddress: tx.from },
            "Deposit auto-credited via fromAddress match"
          );
        } catch (creditErr) {
          await db
            .update(depositVerificationsTable)
            .set({
              status: "pending",
              txid: tx.txid,
              amount: amountUsdt,
              toAddress: businessAddress,
              adminNote: `Auto-credit failed: ${(creditErr as Error)?.message}`,
            })
            .where(eq(depositVerificationsTable.id, matched.id));
          processed.add(tx.txid);
          logger.warn(
            { userId: matched.userId, txid: tx.txid },
            "Deposit matched but credit failed — queued for admin"
          );
        }
      } else {
        // No match — queue as unassigned for admin to manually assign to a user
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
              "Incoming deposit detected — sender not matched to any user. Please assign to a user manually.",
          })
          .onConflictDoNothing();
        processed.add(tx.txid);
        logger.warn(
          { txid: tx.txid, amountUsdt, fromAddress: tx.from },
          "Unmatched deposit queued for admin assignment"
        );
      }
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
