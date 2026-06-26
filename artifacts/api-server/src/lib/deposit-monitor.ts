/**
 * Background deposit monitor — polls BSC RPC every 60s using ethers.js provider.getLogs()
 * to watch for incoming USDT BEP20 transfers to per-user HD deposit addresses.
 *
 * When DEPOSIT_MASTER_KEY (or BSC_HOT_WALLET_PRIVATE_KEY used as seed) is set:
 *   - Loads all wallets that have a depositAddress from the DB
 *   - Passes them as topics[2] OR filter → one getLogs call covers all users
 *   - Auto-credits deposits directly — no admin intervention required
 *
 * Falls back to the legacy single hot-wallet (bscAddress system setting) when no
 * per-user addresses are registered yet.
 *
 * No API key required — uses public BSC RPC endpoints.
 * batchMaxCount: 1 disables batching to avoid -32005 rate-limit errors.
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
import { emitToUser } from "./sse.js";
import { derivePrivateKey } from "./bsc-hd.js";
import { getBnbBalance, getBscUsdtBalance, sendBnb, sendUsdtBsc } from "./bsc.js";

const POLL_INTERVAL_MS = 60_000;

// bsc-dataseed nodes used for getBlockNumber() only — don't support eth_getLogs.
const BSC_BLOCK_NUMBER_ENDPOINTS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
];

// These endpoints support eth_getLogs with no API key.
// nodies/ankr/publicnode allow ≤250 blocks — MAX_BLOCKS_PER_QUERY is 50.
const BSC_GETLOGS_ENDPOINTS = [
  "https://bsc-pokt.nodies.app",
  "https://rpc.ankr.com/bsc",
  "https://bsc.publicnode.com",
];

const BSC_NETWORK = ethers.Network.from(56); // BNB Smart Chain, avoids eth_chainId probe

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_DECIMALS = 18;

// Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// On first run look back ~15 min worth of blocks (~20 blocks/min on BSC)
const INITIAL_LOOKBACK_BLOCKS = 300;
// Hard limit per getLogs query — 1rpc.io free tier allows max 50 blocks.
const MAX_BLOCKS_PER_QUERY = 50;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastProcessedBlock = 0;

// ── Provider helpers ──────────────────────────────────────────────────────────

function makeProvider(url: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(url, BSC_NETWORK, {
    staticNetwork: BSC_NETWORK,
    batchMaxCount: 1,
  });
}

async function withFallback<T>(
  endpoints: string[],
  fn: (provider: ethers.JsonRpcProvider) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const url of endpoints) {
    const p = makeProvider(url);
    try {
      return await fn(p);
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

function padAddress(addr: string): string {
  return "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

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
    return { from, to, amount: `${whole}.${fracStr}` };
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
 * source defaults to "auto_monitor" for monitor-detected deposits;
 * pass "admin_manual" when called from the admin panel.
 */
export async function creditUserDeposit(
  userId: number,
  walletId: number,
  currentBalance: string,
  amountUsdt: string,
  tx: { txid: string; from: string; to: string },
  source: "auto_monitor" | "admin_manual" = "auto_monitor",
): Promise<boolean> {
  const amountFloat = parseFloat(amountUsdt);
  const newBalance  = (parseFloat(currentBalance) + amountFloat).toFixed(6);

  console.log(`[Deposit] Crediting user ${userId}: ${amountUsdt} USDT (txid: ${tx.txid}, source: ${source})`);

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

  const adminNote = source === "admin_manual"
    ? `Manually credited by admin. ${amountUsdt} USDT from ${tx.from}`
    : `Auto-credited by deposit monitor. ${amountUsdt} USDT from ${tx.from} to ${tx.to}`;

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
      source,
      adminNote,
    })
    .onConflictDoNothing();

  // Real-time SSE update — instantly refreshes wallet in open browser tabs
  emitToUser(userId, "wallet_update", {
    type: "deposit_received",
    amount: amountUsdt,
  });

  // Background push — fires even when the app is closed/backgrounded
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

// ── Sweep ─────────────────────────────────────────────────────────────────────

const HOT_WALLET_ADDRESS =
  process.env["BSC_HOT_WALLET_ADDRESS"] || "0x24c3AaC7A62a37333885Bc9a8A82ca4fDe7321B3";

const MIN_BNB_FOR_GAS = 0.001;   // threshold below which we top-up first
const GAS_TOPUP_BNB   = 0.002;   // amount of BNB to send for gas
const SWEEP_DELAY_MS  = 5_000;   // wait after BNB top-up before sweeping USDT

/**
 * Fire-and-forget: sweeps USDT from a user's derived deposit address back to the
 * hot wallet so funds consolidate in one place.
 *
 * - If the derived address has < MIN_BNB_FOR_GAS BNB, sends GAS_TOPUP_BNB first
 *   (from the hot wallet) and waits SWEEP_DELAY_MS for it to confirm.
 * - On any error: logs for admin review — NEVER reverses the user's credit.
 */
async function sweepUsdtToHotWallet(userId: number, userAddress: string, amount: string): Promise<boolean> {
  try {
    const hotPrivKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
    if (!hotPrivKey) {
      console.warn(`[Deposit] Sweep skipped for user ${userId}: BSC_HOT_WALLET_PRIVATE_KEY not set`);
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return false;

    // Derive the user's private key for signing the sweep tx
    const userPrivKey = derivePrivateKey(userId);

    // Check BNB balance on the hot wallet first — it must have BNB to top-up user addresses
    const hotBnbBalance = await getBnbBalance(HOT_WALLET_ADDRESS);
    if (hotBnbBalance < GAS_TOPUP_BNB * 2) {
      console.warn(
        `[Deposit] Sweep SKIPPED for user ${userId}: hot wallet ${HOT_WALLET_ADDRESS} has ` +
        `${hotBnbBalance.toFixed(6)} BNB — needs at least ${GAS_TOPUP_BNB * 2} BNB. ` +
        `Please send BNB to the hot wallet to enable sweeping.`,
      );
      return false;
    }

    // Check BNB balance on the deposit address — need gas to send USDT
    const bnbBalance = await getBnbBalance(userAddress);
    if (bnbBalance < MIN_BNB_FOR_GAS) {
      console.log(
        `[Deposit] User ${userId} address ${userAddress} has ${bnbBalance.toFixed(6)} BNB — ` +
        `topping up ${GAS_TOPUP_BNB} BNB for gas`,
      );
      await sendBnb(hotPrivKey, userAddress, GAS_TOPUP_BNB);
      // Give the BNB tx a moment to propagate before sending USDT
      await new Promise((r) => setTimeout(r, SWEEP_DELAY_MS));
    }

    console.log(`[Deposit] Sweeping ${amount} USDT from ${userAddress} → ${HOT_WALLET_ADDRESS}`);
    const txHash = await sendUsdtBsc(userPrivKey, HOT_WALLET_ADDRESS, amountNum);
    console.log(`[Deposit] Sweep complete txid: ${txHash}`);
    return true;
  } catch (err: any) {
    console.error(
      `[Deposit] Sweep FAILED for user ${userId} (${userAddress}): ${err?.message ?? err} — ` +
      `user balance remains credited; review manually`,
    );
    return false;
  }
}

// ── Address map ───────────────────────────────────────────────────────────────

interface WalletInfo {
  walletId: number;
  userId: number;
  balance: string;
}

/**
 * Load all wallets that have a per-user depositAddress assigned.
 * Returns a map of lowercase address → wallet info.
 */
async function loadUserDepositAddresses(): Promise<Map<string, WalletInfo>> {
  const rows = await db
    .select({
      id: walletsTable.id,
      userId: walletsTable.userId,
      availableBalance: walletsTable.availableBalance,
      depositAddress: walletsTable.depositAddress,
    })
    .from(walletsTable)
    .where(and(eq(walletsTable.asset, "USDT"), isNotNull(walletsTable.depositAddress)));

  // Only include valid EVM addresses (0x + 40 hex chars).
  // Old Tron/Base58 addresses stored from a previous migration are silently skipped.
  const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

  const map = new Map<string, WalletInfo>();
  for (const row of rows) {
    if (row.depositAddress && EVM_ADDRESS_RE.test(row.depositAddress)) {
      map.set(row.depositAddress.toLowerCase(), {
        walletId: row.id,
        userId: row.userId,
        balance: row.availableBalance,
      });
    } else if (row.depositAddress) {
      console.warn(
        `[Deposit] Skipping non-EVM deposit address for wallet ${row.id} (user ${row.userId}): ${row.depositAddress.slice(0, 12)}… — will be re-derived on next user login`,
      );
    }
  }
  return map;
}

// ── Poll ──────────────────────────────────────────────────────────────────────

async function poll() {
  if (isRunning) return;
  isRunning = true;
  try {
    // Load per-user deposit addresses from DB
    const userAddressMap = await loadUserDepositAddresses();
    const hasUserAddresses = userAddressMap.size > 0;

    // Determine which addresses to watch
    let watchAddresses: string[] = []; // lowercase, with 0x
    let legacyHotWallet = "";

    if (hasUserAddresses) {
      watchAddresses = [...userAddressMap.keys()];
      console.log(`[Deposit] Watching ${watchAddresses.length} per-user deposit address(es)`);
    } else {
      // Fall back to single hot wallet from system_settings
      legacyHotWallet = await getSetting("bscAddress");
      if (!legacyHotWallet) {
        logger.debug("[Deposit] No per-user deposit addresses or bscAddress configured — skipping poll");
        return;
      }
      watchAddresses = [legacyHotWallet.toLowerCase()];
      console.log(`[Deposit] Watching legacy hot wallet: ${legacyHotWallet}`);
    }

    // Pad all watch addresses for topic[2] OR filtering
    const paddedTopics = watchAddresses.map(padAddress);

    let currentBlock: number;
    try {
      currentBlock = await withFallback(BSC_BLOCK_NUMBER_ENDPOINTS, (p) => p.getBlockNumber());
    } catch (err) {
      logger.error({ err }, "[Deposit] Could not fetch BSC block number — skipping poll");
      return;
    }

    let chunkStart = lastProcessedBlock > 0
      ? lastProcessedBlock + 1
      : Math.max(0, currentBlock - INITIAL_LOOKBACK_BLOCKS);

    if (chunkStart > currentBlock) {
      lastProcessedBlock = currentBlock;
      return;
    }

    const processedHashes = await getProcessedTxHashes();

    // Iterate through all pending 50-block chunks.
    // On steady-state: one chunk (~20 new blocks per 60s).
    // On first start: up to ceil(300/50) = 6 chunks.
    while (chunkStart <= currentBlock) {
      const chunkEnd = Math.min(chunkStart + MAX_BLOCKS_PER_QUERY - 1, currentBlock);

      console.log(
        `[Deposit] Scanning blocks ${chunkStart}–${chunkEnd}` +
        (hasUserAddresses ? ` (${watchAddresses.length} user addresses)` : ` (hot wallet: ${legacyHotWallet})`),
      );

      let logs: ethers.Log[];
      try {
        // topics[2] is a single string or array — ethers handles OR matching for arrays
        const topic2 = paddedTopics.length === 1 ? paddedTopics[0] : paddedTopics;
        logs = await withFallback(BSC_GETLOGS_ENDPOINTS, (p) =>
          p.getLogs({
            fromBlock: chunkStart,
            toBlock:   chunkEnd,
            address: USDT_CONTRACT,
            topics: [TRANSFER_TOPIC, null, topic2],
          }),
        );
      } catch (err) {
        logger.error({ err, chunkStart, chunkEnd }, "[Deposit] provider.getLogs() failed — stopping catch-up at this chunk");
        lastProcessedBlock = chunkStart - 1;
        return;
      }

      lastProcessedBlock = chunkEnd;

      if (logs.length === 0) {
        console.log(`[Deposit] No USDT transfers in blocks ${chunkStart}–${chunkEnd}`);
      } else {
        console.log(`[Deposit] Found ${logs.length} USDT transfer(s) in blocks ${chunkStart}–${chunkEnd}`);

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

          const amountFloat = parseFloat(parsed.amount);
          if (isNaN(amountFloat) || amountFloat <= 0) continue;

          const toLower = parsed.to.toLowerCase();

          if (hasUserAddresses) {
            // Per-user mode: look up which user owns this deposit address and auto-credit
            const walletInfo = userAddressMap.get(toLower);
            if (!walletInfo) continue; // shouldn't happen given topics filter, but be safe

            console.log(
              `[Deposit] Auto-crediting user ${walletInfo.userId}: ${parsed.amount} USDT ` +
              `from ${parsed.from} (block ${log.blockNumber}, tx: ${txHash})`,
            );

            await creditUserDeposit(
              walletInfo.userId,
              walletInfo.walletId,
              walletInfo.balance,
              parsed.amount,
              { txid: log.transactionHash, from: parsed.from, to: parsed.to },
              "auto_monitor",
            );

            // Update the balance in our in-memory map so concurrent deposits in the same
            // chunk are accumulated correctly without an extra DB round-trip
            walletInfo.balance = (parseFloat(walletInfo.balance) + amountFloat).toFixed(6);

            // Fire-and-forget sweep: move USDT from user's deposit address → hot wallet
            sweepUsdtToHotWallet(walletInfo.userId, parsed.to, parsed.amount).catch(() => {});

          } else {
            // Legacy mode: flag deposit as pending for admin to assign manually
            if (toLower !== legacyHotWallet.toLowerCase()) continue;

            console.log(
              `[Deposit] New deposit to hot wallet: ${parsed.amount} USDT from ${parsed.from} ` +
              `(block ${log.blockNumber}, tx: ${txHash})`,
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
          }

          processedHashes.add(txHash);
        }
      }

      chunkStart = chunkEnd + 1;
    }
  } catch (err) {
    logger.error({ err }, "[Deposit] poll error");
  } finally {
    isRunning = false;
  }
}

// ── Balance Sweep ──────────────────────────────────────────────────────────────

const BALANCE_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let balanceSweepInterval: ReturnType<typeof setInterval> | null = null;
let isSweepRunning = false;

/**
 * Sweeps USDT from ALL user deposit addresses that hold a balance > 0.
 * Runs on startup and every hour to recover any funds that weren't swept
 * (e.g. because BSC_HOT_WALLET_PRIVATE_KEY was missing at deposit time).
 * Exported so the admin panel can trigger it on-demand.
 */
export async function sweepAllStuckFunds(): Promise<{ swept: number; failed: number }> {
  if (isSweepRunning) {
    console.log("[BalanceSweep] Already running — skipping");
    return { swept: 0, failed: 0 };
  }
  isSweepRunning = true;

  const hotPrivKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
  if (!hotPrivKey) {
    console.warn("[BalanceSweep] BSC_HOT_WALLET_PRIVATE_KEY not set — skipping balance sweep");
    isSweepRunning = false;
    return { swept: 0, failed: 0 };
  }

  console.log("[BalanceSweep] Starting sweep of all user deposit addresses…");
  let swept = 0;
  let failed = 0;

  try {
    const userAddressMap = await loadUserDepositAddresses();
    if (userAddressMap.size === 0) {
      console.log("[BalanceSweep] No user deposit addresses found — nothing to sweep");
      return { swept: 0, failed: 0 };
    }

    for (const [address, walletInfo] of userAddressMap.entries()) {
      try {
        const usdtBalance = await getBscUsdtBalance(address);
        const balanceNum = parseFloat(usdtBalance);
        if (isNaN(balanceNum) || balanceNum < 0.01) continue;

        console.log(
          `[BalanceSweep] User ${walletInfo.userId} deposit address ${address} holds ` +
          `${usdtBalance} USDT — sweeping to hot wallet`,
        );
        const ok = await sweepUsdtToHotWallet(walletInfo.userId, address, usdtBalance);
        if (ok) swept++; else failed++;
      } catch (err: any) {
        console.error(
          `[BalanceSweep] Failed for user ${walletInfo.userId} (${address}): ${err?.message ?? err}`,
        );
        failed++;
      }
    }
  } finally {
    isSweepRunning = false;
  }

  console.log(`[BalanceSweep] Done — swept: ${swept}, failed: ${failed}`);
  return { swept, failed };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function startDepositMonitor() {
  if (monitorInterval) return;
  logger.info("Starting BEP20 deposit monitor — per-user HD addresses via ethers.js getLogs (60s interval)");
  poll();
  monitorInterval = setInterval(poll, POLL_INTERVAL_MS);

  // Run a balance sweep on startup (catches any stuck funds from previous runs
  // where BSC_HOT_WALLET_PRIVATE_KEY was missing), then repeat every hour
  setTimeout(() => {
    sweepAllStuckFunds().catch((err) =>
      console.error("[BalanceSweep] Startup sweep error:", err),
    );
  }, 15_000); // 15s delay so the server is fully up first

  balanceSweepInterval = setInterval(() => {
    sweepAllStuckFunds().catch((err) =>
      console.error("[BalanceSweep] Periodic sweep error:", err),
    );
  }, BALANCE_SWEEP_INTERVAL_MS);
}

export function stopDepositMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("BEP20 deposit monitor stopped");
  }
  if (balanceSweepInterval) {
    clearInterval(balanceSweepInterval);
    balanceSweepInterval = null;
  }
}
