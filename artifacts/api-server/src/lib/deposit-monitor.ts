/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to the hot wallet address, then credits user balances automatically.
 *
 * Strategy:
 *   - Each user shares the same hot wallet (set in system_settings.trc20Address)
 *   - We match incoming txs to users by looking up who requested a deposit
 *     in the last 24h AND matches the exact amount (simple approach, sufficient
 *     for MVP; upgrade to per-user addresses later if needed)
 *   - Already-processed tx hashes are stored in transactions table (type=deposit, txid set)
 */

import { db } from "@workspace/db";
import { transactionsTable, walletsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getTrc20Transactions, rawToUsdt } from "./tron.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 60_000; // 60 seconds
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function getProcessedTxIds(): Promise<Set<string>> {
  const rows = await db
    .select({ txid: transactionsTable.txid })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.type, "deposit"),
      isNotNull(transactionsTable.txid),
    ));
  return new Set(rows.map(r => r.txid!));
}

async function creditDeposit(userId: number, amountUsdt: string, txid: string, network: string) {
  // Find or create wallet
  let walletRows = await db.select().from(walletsTable).where(
    and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT"))
  );
  let wallet = walletRows[0];
  if (!wallet) {
    const [w] = await db.insert(walletsTable).values({
      userId,
      asset: "USDT",
      availableBalance: "0.00",
      frozenBalance: "0.00",
    }).returning();
    wallet = w;
  }

  const newBalance = (parseFloat(wallet.availableBalance) + parseFloat(amountUsdt)).toFixed(6);

  // Update balance
  await db.update(walletsTable)
    .set({ availableBalance: newBalance, updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));

  // Record transaction
  await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amountUsdt,
    network,
    status: "completed",
    txid,
  });

  logger.info({ userId, amountUsdt, txid }, "Deposit credited");
}

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    const hotWallet = await getSetting("trc20Address");
    if (!hotWallet) {
      logger.debug("Deposit monitor: trc20Address not configured, skipping");
      return;
    }

    const processed = await getProcessedTxIds();

    // Look at transactions from the last 24 hours
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const txs = await getTrc20Transactions(hotWallet, since);

    for (const tx of txs) {
      // Only process confirmed incoming deposits
      if (!tx.confirmed) continue;
      if (tx.to.toLowerCase() !== hotWallet.toLowerCase()) continue;
      if (processed.has(tx.txid)) continue;

      const amountUsdt = rawToUsdt(tx.value);
      const amountFloat = parseFloat(amountUsdt);
      if (amountFloat <= 0) continue;

      // Look for a pending deposit request matching this amount
      // Pending deposits are rows with type=deposit, status=pending, no txid yet
      const pendingRows = await db
        .select()
        .from(transactionsTable)
        .where(and(
          eq(transactionsTable.type, "deposit"),
          eq(transactionsTable.status, "pending"),
          eq(transactionsTable.amount, amountFloat.toFixed(6)),
        ));

      if (pendingRows.length > 0) {
        // Match found — credit the first pending depositor
        const pending = pendingRows[0];
        await db.update(transactionsTable)
          .set({ status: "completed", txid: tx.txid })
          .where(eq(transactionsTable.id, pending.id));

        // Credit wallet
        const walletRows = await db.select().from(walletsTable).where(
          and(eq(walletsTable.userId, pending.userId), eq(walletsTable.asset, "USDT"))
        );
        if (walletRows[0]) {
          const newBal = (parseFloat(walletRows[0].availableBalance) + amountFloat).toFixed(6);
          await db.update(walletsTable)
            .set({ availableBalance: newBal, updatedAt: new Date() })
            .where(eq(walletsTable.id, walletRows[0].id));
          logger.info({ userId: pending.userId, amountUsdt, txid: tx.txid }, "Pending deposit matched and credited");
        }
      } else {
        // No pending request — log as unmatched (admin can manually credit)
        logger.warn({ txid: tx.txid, amountUsdt, from: tx.from }, "Unmatched deposit received on hot wallet");
        // Still record it so we don't reprocess it
        await db.insert(transactionsTable).values({
          userId: 0, // unmatched
          type: "deposit",
          amount: amountUsdt,
          network: "TRC20",
          status: "pending",
          txid: tx.txid,
          address: tx.from,
        }).catch(() => {}); // ignore duplicate errors
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
  logger.info("Starting TRC20 deposit monitor (60s interval)");
  // Run immediately on start, then every 60s
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
