/**
 * Background deposit monitor — polls BSC RPC every 60s using ethers.js provider.getLogs()
 * to watch for incoming USDT BEP20 transfers to the hot wallet address.
 *
 * No API key required — uses public BSC RPC directly (bsc-dataseed.binance.org primary).
 * Batching is disabled (batchMaxCount: 1) to avoid -32005 rate limit errors on dataseed nodes.
 *
 * creditUserDeposit() is exported for the admin "manual credit" flow.
 */

import { ethers } from "ethers";
import { db } from "@workspace/db";
import {
  transactionsTable,
  walletsTable,
  depositVerificationsTable,
  systemSettingsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { logger } from "./logger.js";
import { PushNotify } from "../routes/push.js";

const POLL_INTERVAL_MS = 60_000;

// bsc-dataseed nodes are used for getBlockNumber() only — they don't support eth_getLogs.
// The endpoints below support full eth_getLogs queries with no API key.
const BSC_BLOCK_NUMBER_ENDPOINTS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
];

// These endpoints confirmed to support eth_getLogs on the free tier.
// 1rpc allows ≤50 blocks; nodies allows ≤250 blocks — MAX_BLOCKS_PER_QUERY is set to 50.
const BSC_GETLOGS_ENDPOINTS = [
  "https://1rpc.io/bnb",
  "https://bsc-pokt.nodies.app",
];

const BSC_NETWORK = ethers.Network.from(56); // BNB Smart Chain, avoids eth_chainId probe

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_DECIMALS = 18;

// Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// On first run look back ~15 min worth of blocks
const INITIAL_LOOKBACK_BLOCKS = 300;
// Stay within 1rpc.io's free-tier limit of 50 blocks per query.
// BSC produces ~20 blocks/min so 50 blocks covers each 60s poll window easily.
const MAX_BLOCKS_PER_QUERY = 50;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastProcessedBlock = 0;

// ── Provider helpers ──────────────────────────────────────────────────────────

/**
 * Make a non-batching JsonRpcProvider for a given URL.
 * staticNetwork skips the eth_chainId detection call.
 * batchMaxCount:1 ensures every request is sent individually (no batching).
 */
function makeProvider(url: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(url, BSC_NETWORK, {
    staticNetwork: BSC_NETWORK,
    batchMaxCount: 1,
  });
}

/**
 * Try each RPC endpoint in order and return the first successful result.
 */
async function withFallback<T>(
  endpoints: string[],
  fn: (provider: ethers.JsonRpcProvider) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const url of endpoints) {
    const p = makeProvider(url);
    try {
      const result = await fn(p);
      return result;
    } catch (err: any) {
      console.warn(`[Deposit] RPC call failed on ${url}: ${err?.message ?? err}`);
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("All BSC RPC endpoints failed");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key));
  return rows[0]?.value?.trim() ?? "";
}

/** Parse an ethers Log → { from, to, amount } */
function parseTransferLog(log: ethers.Log): { from: string; to: string; amount: string } | null {
  try {
    if (!log.topics || log.topics.length < 3) return null;
    const from = "0x" + log.topics[1].slice(-40);
    const to   = "0x" + log.topics[2].slice(-40);
    const rawValue = BigInt(log.data);
    const divisor  = BigInt(10 ** USDT_DECIMALS);
    const whole    = rawValue / divisor;
    const frac     = rawValue % divisor;
    const fracStr  = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
    const amount   = `${whole}.${fracStr}`;
    return { from, to, amount };
  } catch {
    return null;
  }
}

async function getProcessedTxHashes(): Promise<Set<string>> {
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
  txHash: string,
): Promise<void> {
  try {
    const apiKey = await getSetting("brevoApiKey");
    if (!apiKey) return;
    const senderEmail = (await getSetting("brevoSenderEmail")) || "noreply@xendrx.com";
    const senderName  = (await getSetting("brevoSenderName"))  || "Xendrx";
    const date = new Date().toLocaleString("en-US", {
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
 * Exported for use by the admin manual-credit endpoint.
 */
export async function creditUserDeposit(
  userId: number,
  walletId: number,
  currentBalance: string,
  amountUsdt: string,
  tx: { txid: string; from: string; to: string },
): Promise<boolean> {
  const amountFloat = parseFloat(amountUsdt);
  const newBalance  = (parseFloat(currentBalance) + amountFloat).toFixed(6);

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

  db.select({ email: usersTable.email, emailVerified: usersTable.emailVerified, username: usersTable.username })
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
    const hotWalletAddress = await getSetting("bscAddress");
    if (!hotWalletAddress) {
      logger.debug("[Deposit] bscAddress not configured in system_settings — skipping poll");
      return;
    }

    let currentBlock: number;
    try {
      currentBlock = await withFallback(BSC_BLOCK_NUMBER_ENDPOINTS, (p) => p.getBlockNumber());
    } catch (err) {
      logger.error({ err }, "[Deposit] Could not fetch BSC block number — skipping poll");
      return;
    }

    const fromBlock = lastProcessedBlock > 0
      ? lastProcessedBlock + 1
      : Math.max(0, currentBlock - INITIAL_LOOKBACK_BLOCKS);

    if (fromBlock > currentBlock) {
      lastProcessedBlock = currentBlock;
      return;
    }

    const toBlock = Math.min(fromBlock + MAX_BLOCKS_PER_QUERY - 1, currentBlock);

    console.log(`[Deposit] Scanning blocks ${fromBlock}–${toBlock} for USDT transfers to ${hotWalletAddress}`);

    // Pad hot wallet address to 32-byte topic
    const paddedAddress = "0x" + hotWalletAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");

    let logs: ethers.Log[];
    try {
      logs = await withFallback(BSC_GETLOGS_ENDPOINTS, (p) =>
        p.getLogs({
          fromBlock,
          toBlock,
          address: USDT_CONTRACT,
          topics: [
            TRANSFER_TOPIC,
            null,           // any sender
            paddedAddress,  // to = our hot wallet
          ],
        }),
      );
    } catch (err) {
      logger.error({ err, fromBlock, toBlock }, "[Deposit] provider.getLogs() failed on all endpoints — skipping this range");
      return;
    }

    lastProcessedBlock = toBlock;

    if (logs.length === 0) {
      console.log(`[Deposit] No new USDT transfers found in blocks ${fromBlock}–${toBlock}`);
      return;
    }

    console.log(`[Deposit] Found ${logs.length} USDT transfer(s) to hot wallet`);

    const processedHashes = await getProcessedTxHashes();

    for (const log of logs) {
      const txHash = log.transactionHash.toLowerCase();

      if (processedHashes.has(txHash)) {
        console.log(`[Deposit] Already processed: ${txHash}`);
        continue;
      }

      const parsed = parseTransferLog(log);
      if (!parsed) {
        console.warn(`[Deposit] Could not parse log for txHash ${txHash}`);
        continue;
      }

      if (parsed.to.toLowerCase() !== hotWalletAddress.toLowerCase()) continue;

      const amountFloat = parseFloat(parsed.amount);
      if (isNaN(amountFloat) || amountFloat <= 0) continue;

      console.log(
        `[Deposit] New unmatched BEP20 deposit: ${parsed.amount} USDT from ${parsed.from} ` +
        `(block ${log.blockNumber}, txHash: ${txHash})`,
      );

      await db
        .insert(depositVerificationsTable)
        .values({
          userId: 0,
          txid: log.transactionHash,
          amount: parsed.amount,
          fromAddress: parsed.from,
          toAddress: parsed.to,
          network: "BEP20",
          status: "pending",
          source: "auto_monitor",
          adminNote: `Auto-detected by BSC RPC monitor at block ${log.blockNumber}. Sender: ${parsed.from}. Assign to user manually.`,
        })
        .onConflictDoNothing();

      processedHashes.add(txHash);
    }
  } catch (err) {
    logger.error({ err }, "[Deposit] poll error");
  } finally {
    isRunning = false;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function startDepositMonitor() {
  if (monitorInterval) return;
  logger.info("Starting BEP20 deposit monitor — ethers.js provider.getLogs() via bsc-dataseed.binance.org (60s interval, no API key needed)");
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
