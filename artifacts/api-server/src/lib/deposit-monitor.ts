/**
 * Background deposit monitor — polls BSC RPC every 60s using ethers.js getLogs()
 * to watch for incoming USDT BEP20 transfers to the hot wallet address.
 *
 * No API key required — uses free public BSC RPC nodes directly.
 *
 * creditUserDeposit() is exported for the admin "manual credit" flow.
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
import { logger } from "./logger.js";
import { PushNotify } from "../routes/push.js";

const POLL_INTERVAL_MS = 60_000;
// Public BSC RPC nodes that support eth_getLogs (dataseed nodes do NOT)
const BSC_RPC_ENDPOINTS = [
  "https://rpc.ankr.com/bsc",
  "https://bsc-rpc.publicnode.com",
  "https://1rpc.io/bnb",
  "https://bsc.drpc.org",
];
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_DECIMALS = 18;

// Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// On first run, look back 300 blocks (~15 minutes on BSC, ~3s/block)
const INITIAL_LOOKBACK_BLOCKS = 300;
// Max blocks per getLogs query (BSC public RPC handles up to ~5000 but we keep it conservative)
const MAX_BLOCKS_PER_QUERY = 500;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastProcessedBlock = 0;

// ── Raw JSON-RPC helpers (no batching — avoids -32005 rate limit errors) ─────

interface RpcLog {
  transactionHash: string;
  blockNumber: string;
  address: string;
  topics: string[];
  data: string;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  for (const endpoint of BSC_RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const json = await res.json() as { result?: T; error?: { code: number; message: string } };
      if (json.error) throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
      if (json.result === undefined) throw new Error("RPC returned no result");
      return json.result as T;
    } catch (err: any) {
      console.warn(`[Deposit] RPC ${method} failed on ${endpoint}: ${err.message}`);
    }
  }
  throw new Error(`All BSC RPC endpoints failed for ${method}`);
}

async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall<string>("eth_blockNumber", []);
  return parseInt(hex, 16);
}

async function getLogs(fromBlock: number, toBlock: number, address: string, topics: (string | null)[]): Promise<RpcLog[]> {
  return rpcCall<RpcLog[]>("eth_getLogs", [{
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock:   "0x" + toBlock.toString(16),
    address,
    topics,
  }]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key));
  return rows[0]?.value?.trim() ?? "";
}

/** Parse a raw BEP20 Transfer log → { from, to, amount } */
function parseTransferLog(log: RpcLog): { from: string; to: string; amount: string } | null {
  try {
    if (!log.topics || log.topics.length < 3) return null;
    const from = "0x" + log.topics[1].slice(-40);
    const to   = "0x" + log.topics[2].slice(-40);
    const rawValue = BigInt(log.data);
    const divisor = BigInt(10 ** USDT_DECIMALS);
    const whole = rawValue / divisor;
    const frac  = rawValue % divisor;
    const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
    const amount = `${whole}.${fracStr}`;
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
  txHash: string
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

    // Get current block via raw RPC (no batching)
    let currentBlock: number;
    try {
      currentBlock = await getBlockNumber();
    } catch (err) {
      logger.error({ err }, "[Deposit] Could not fetch BSC block number — skipping poll");
      return;
    }

    // On first run, look back INITIAL_LOOKBACK_BLOCKS; otherwise continue from where we left off
    const fromBlock = lastProcessedBlock > 0
      ? lastProcessedBlock + 1
      : Math.max(0, currentBlock - INITIAL_LOOKBACK_BLOCKS);

    if (fromBlock > currentBlock) {
      lastProcessedBlock = currentBlock;
      return;
    }

    // Cap per-query range to avoid RPC limits
    const toBlock = Math.min(fromBlock + MAX_BLOCKS_PER_QUERY - 1, currentBlock);

    console.log(`[Deposit] Scanning blocks ${fromBlock}–${toBlock} for USDT transfers to ${hotWalletAddress}`);

    // Pad hot wallet to 32-byte topic value
    const paddedAddress = "0x" + hotWalletAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");

    let logs: RpcLog[];
    try {
      logs = await getLogs(fromBlock, toBlock, USDT_CONTRACT, [
        TRANSFER_TOPIC,
        null,           // any sender
        paddedAddress,  // to = our hot wallet
      ]);
    } catch (err) {
      logger.error({ err, fromBlock, toBlock }, "[Deposit] getLogs failed — skipping this range");
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
        `(block ${log.blockNumber}, txHash: ${txHash})`
      );

      // Record as a pending verification for admin review
      await db
        .insert(depositVerificationsTable)
        .values({
          userId: 0,           // unknown until admin assigns it
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

      processedHashes.add(txHash); // prevent double-insert within this batch
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
  logger.info("Starting BEP20 deposit monitor via BSC RPC getLogs (60s interval, no API key needed)");
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
