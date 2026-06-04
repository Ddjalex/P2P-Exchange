/**
 * Background deposit monitor — polls TronGrid every 60s for incoming USDT TRC20
 * deposits to each user's unique deposit address, then credits balances automatically.
 *
 * Strategy:
 *   - Every user has their own unique deposit address (derived from DEPOSIT_MASTER_SEED + userId)
 *   - The address is stored in wallets.deposit_address after first request
 *   - We poll each user's address for confirmed incoming TRC20 USDT transactions
 *   - Already-processed tx hashes are stored in transactions table (type=deposit, txid set)
 */

import { db } from "@workspace/db";
import { transactionsTable, walletsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getTrc20Transactions, rawToUsdt } from "./tron.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 60_000; // 60 seconds
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

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

  await db.update(walletsTable)
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

  logger.info({ userId, amountUsdt, txid }, "Deposit credited to user wallet");
}

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    // Fetch all wallets that have been assigned a unique deposit address
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(and(
        isNotNull(walletsTable.depositAddress),
        eq(walletsTable.asset, "USDT"),
      ));

    if (wallets.length === 0) {
      logger.debug("Deposit monitor: no user deposit addresses found, skipping");
      return;
    }

    const processed = await getProcessedTxIds();
    const since = Date.now() - 24 * 60 * 60 * 1000; // last 24 hours

    for (const wallet of wallets) {
      if (!wallet.depositAddress) continue;

      try {
        const txs = await getTrc20Transactions(wallet.depositAddress, since);

        for (const tx of txs) {
          if (!tx.confirmed) continue;
          if (processed.has(tx.txid)) continue;

          // Verify the tx is actually arriving AT this user's deposit address
          if (tx.to.toLowerCase() !== wallet.depositAddress.toLowerCase()) continue;

          const amountUsdt = rawToUsdt(tx.value);
          const amountFloat = parseFloat(amountUsdt);
          if (amountFloat <= 0) continue;

          await creditDeposit(wallet.userId, amountUsdt, tx.txid, "TRC20");
          processed.add(tx.txid); // prevent double-processing within same poll run
        }
      } catch (err) {
        logger.error({ err, userId: wallet.userId, address: wallet.depositAddress }, "Error polling user deposit address");
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
