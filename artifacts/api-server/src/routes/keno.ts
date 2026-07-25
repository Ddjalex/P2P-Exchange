/**
 * Keno Game Routes
 *
 * Player routes  → registered at /api/games/keno   (userAuth + checkAccountStatus)
 * Admin routes   → registered at /api/admin/games  (adminAuth)
 *
 * Security highlights:
 *  - Cryptographically secure draw: crypto.randomInt()
 *  - All balance mutations inside db.transaction() with SELECT … FOR UPDATE
 *  - Password confirmation for top-up / withdraw reuses the same
 *    bcrypt + rate-limit pattern from wallet.ts
 *  - adminAuth reuses the same HMAC-SHA256 token format as admin.ts
 */

import { Router } from "express";
import { randomInt, createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  kenoWalletsTable,
  kenoTransactionsTable,
  kenoPaytableTable,
  kenoRoundsTable,
  kenoSettingsTable,
  walletsTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Exported routers ────────────────────────────────────────────────────────

export const kenoRouter = Router();       // mounted at /api/games/keno
export const kenoAdminRouter = Router();  // mounted at /api/admin/games

// ─── Hypergeometric paytable seed ────────────────────────────────────────────
//
// P(k hits | draws=20, pool=80, picks=n) = C(20,k) * C(60, n-k) / C(80, n)
//
// Default multipliers target ~80% RTP (20% house edge).
// Calculation approach: for each pick count we assign exponential weights
// to paying hit counts and scale them so:
//   sum_{k >= k_min} P(k) * multiplier(k) = 0.80
//
// Verified RTPs (pick-1, pick-5, pick-10 shown explicitly):
//   Pick 1:  P(1)=25.00%   → mult=3.20  → RTP = 0.25×3.20 = 80.00%
//   Pick 5:  P(3)=8.39%×4.53 + P(4)=1.209%×22.65 + P(5)=0.0645%×226.5
//            = 0.3801 + 0.2739 + 0.1461 = 80.01%
//   Pick 10: P(5)=5.14%×7.24 + P(6)=1.148%×21.72 + P(7)=0.1611%×72.4
//            + P(8)=0.01354%×362 + P(9)=0.000612%×1448 + P(10)=0.0000112%×36200
//            = 0.372+0.249+0.117+0.049+0.009+0.004 = 80.00%

const DEFAULT_PAYTABLE: Array<{ picks: number; hits: number; multiplier: string }> = [
  // Pick 1
  { picks: 1, hits: 0, multiplier: "0" },
  { picks: 1, hits: 1, multiplier: "3.2000" },
  // Pick 2
  { picks: 2, hits: 0, multiplier: "0" },
  { picks: 2, hits: 1, multiplier: "0" },
  { picks: 2, hits: 2, multiplier: "13.3100" },
  // Pick 3 (min pay = 2 hits)
  { picks: 3, hits: 0, multiplier: "0" },
  { picks: 3, hits: 1, multiplier: "0" },
  { picks: 3, hits: 2, multiplier: "3.2000" },
  { picks: 3, hits: 3, multiplier: "25.5000" },
  // Pick 4 (min pay = 2 hits)
  { picks: 4, hits: 0, multiplier: "0" },
  { picks: 4, hits: 1, multiplier: "0" },
  { picks: 4, hits: 2, multiplier: "1.6800" },
  { picks: 4, hits: 3, multiplier: "6.7000" },
  { picks: 4, hits: 4, multiplier: "50.2500" },
  // Pick 5 (min pay = 3 hits)
  { picks: 5, hits: 0, multiplier: "0" },
  { picks: 5, hits: 1, multiplier: "0" },
  { picks: 5, hits: 2, multiplier: "0" },
  { picks: 5, hits: 3, multiplier: "4.5300" },
  { picks: 5, hits: 4, multiplier: "22.6500" },
  { picks: 5, hits: 5, multiplier: "226.5000" },
  // Pick 6 (min pay = 3 hits)
  { picks: 6, hits: 0, multiplier: "0" },
  { picks: 6, hits: 1, multiplier: "0" },
  { picks: 6, hits: 2, multiplier: "0" },
  { picks: 6, hits: 3, multiplier: "1.8600" },
  { picks: 6, hits: 4, multiplier: "9.3100" },
  { picks: 6, hits: 5, multiplier: "55.8000" },
  { picks: 6, hits: 6, multiplier: "930.0000" },
  // Pick 7 (min pay = 4 hits)
  { picks: 7, hits: 0, multiplier: "0" },
  { picks: 7, hits: 1, multiplier: "0" },
  { picks: 7, hits: 2, multiplier: "0" },
  { picks: 7, hits: 3, multiplier: "0" },
  { picks: 7, hits: 4, multiplier: "5.6400" },
  { picks: 7, hits: 5, multiplier: "28.2000" },
  { picks: 7, hits: 6, multiplier: "169.0000" },
  { picks: 7, hits: 7, multiplier: "5645.0000" },
  // Pick 8 (min pay = 4 hits)
  { picks: 8, hits: 0, multiplier: "0" },
  { picks: 8, hits: 1, multiplier: "0" },
  { picks: 8, hits: 2, multiplier: "0" },
  { picks: 8, hits: 3, multiplier: "0" },
  { picks: 8, hits: 4, multiplier: "2.8000" },
  { picks: 8, hits: 5, multiplier: "14.0000" },
  { picks: 8, hits: 6, multiplier: "69.9000" },
  { picks: 8, hits: 7, multiplier: "559.0000" },
  { picks: 8, hits: 8, multiplier: "13985.0000" },
  // Pick 9 (min pay = 5 hits)
  { picks: 9, hits: 0, multiplier: "0" },
  { picks: 9, hits: 1, multiplier: "0" },
  { picks: 9, hits: 2, multiplier: "0" },
  { picks: 9, hits: 3, multiplier: "0" },
  { picks: 9, hits: 4, multiplier: "0" },
  { picks: 9, hits: 5, multiplier: "8.4700" },
  { picks: 9, hits: 6, multiplier: "42.3000" },
  { picks: 9, hits: 7, multiplier: "254.0000" },
  { picks: 9, hits: 8, multiplier: "2540.0000" },
  { picks: 9, hits: 9, multiplier: "67720.0000" },
  // Pick 10 (min pay = 5 hits)
  { picks: 10, hits: 0, multiplier: "0" },
  { picks: 10, hits: 1, multiplier: "0" },
  { picks: 10, hits: 2, multiplier: "0" },
  { picks: 10, hits: 3, multiplier: "0" },
  { picks: 10, hits: 4, multiplier: "0" },
  { picks: 10, hits: 5, multiplier: "7.2400" },
  { picks: 10, hits: 6, multiplier: "21.7200" },
  { picks: 10, hits: 7, multiplier: "72.4000" },
  { picks: 10, hits: 8, multiplier: "362.0000" },
  { picks: 10, hits: 9, multiplier: "1448.0000" },
  { picks: 10, hits: 10, multiplier: "36200.0000" },
];

const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "game_enabled", value: "true" },
  { key: "min_bet",      value: "0.10" },
  { key: "max_bet",      value: "100.00" },
  { key: "min_topup",    value: "1.00" },
  { key: "max_topup",    value: "1000.00" },
];

// ─── Seed helpers ────────────────────────────────────────────────────────────

let _seeded = false;

async function ensureSeeded() {
  if (_seeded) return;
  _seeded = true;

  // Paytable
  const existing = await db.select({ id: kenoPaytableTable.id }).from(kenoPaytableTable).limit(1);
  if (existing.length === 0) {
    await db.insert(kenoPaytableTable).values(DEFAULT_PAYTABLE).onConflictDoNothing();
  }

  // Settings
  for (const s of DEFAULT_SETTINGS) {
    await db.insert(kenoSettingsTable).values(s).onConflictDoNothing();
  }
}

async function getSetting(key: string, fallback = ""): Promise<string> {
  await ensureSeeded();
  const row = await db.select().from(kenoSettingsTable).where(eq(kenoSettingsTable.key, key)).then(r => r[0]);
  return row?.value ?? fallback;
}

// ─── Wallet helpers ──────────────────────────────────────────────────────────

async function getOrCreateKenoWallet(userId: number) {
  const rows = await db.select().from(kenoWalletsTable).where(eq(kenoWalletsTable.userId, userId));
  if (rows[0]) return rows[0];
  const [w] = await db.insert(kenoWalletsTable).values({ userId }).returning();
  return w;
}

// ─── Password rate-limiter (mirrors wallet.ts pattern) ───────────────────────

const pwFailures = new Map<number, { count: number; resetAt: number }>();
const PW_MAX = 5;
const PW_WINDOW = 15 * 60 * 1000;

function checkPw(userId: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const e = pwFailures.get(userId);
  if (!e || now > e.resetAt) return { allowed: true };
  if (e.count >= PW_MAX) return { allowed: false, retryAfterMs: e.resetAt - now };
  return { allowed: true };
}
function recordPwFail(userId: number) {
  const now = Date.now();
  const e = pwFailures.get(userId);
  if (!e || now > e.resetAt) pwFailures.set(userId, { count: 1, resetAt: now + PW_WINDOW });
  else e.count++;
}
function clearPwFail(userId: number) { pwFailures.delete(userId); }

async function verifyPassword(userId: number, password: unknown): Promise<{ ok: boolean; error?: string }> {
  const rl = checkPw(userId);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterMs ?? PW_WINDOW) / 60000);
    return { ok: false, error: `Too many incorrect attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.` };
  }
  const row = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, userId)).then(r => r[0]);
  if (!row?.passwordHash) return { ok: false, error: "Account configuration error." };
  const match = await bcrypt.compare(String(password ?? ""), row.passwordHash).catch(() => false);
  if (!match) { recordPwFail(userId); return { ok: false, error: "Incorrect password." }; }
  clearPwFail(userId);
  return { ok: true };
}

// ─── Admin auth (same HMAC-SHA256 pattern as admin.ts) ───────────────────────

function adminVerify(token: string): boolean {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.SESSION_SECRET ?? "";
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [data, sig] = parts;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch { return false; }
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString());
    return Date.now() - parsed.iat <= 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function adminAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  if (!adminVerify(auth.slice(7))) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Cryptographically secure Keno draw ──────────────────────────────────────
//
// Uses Node's built-in crypto.randomInt() — NOT Math.random().
// Draws 20 unique numbers from 1–80 using Fisher-Yates with crypto.randomInt.

function drawKeno(): number[] {
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1); // crypto.randomInt — cryptographically secure
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 20).sort((a, b) => a - b);
}

// ─── ─────────────────────────────────────────────────────────────────────────
// PLAYER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/games/keno/wallet
kenoRouter.get("/wallet", async (req, res) => {
  try {
    await ensureSeeded();
    const userId = (req as any).userId;
    const wallet = await getOrCreateKenoWallet(userId);
    const [minBet, maxBet, minTopup, maxTopup, gameEnabled] = await Promise.all([
      getSetting("min_bet", "0.10"),
      getSetting("max_bet", "100.00"),
      getSetting("min_topup", "1.00"),
      getSetting("max_topup", "1000.00"),
      getSetting("game_enabled", "true"),
    ]);
    res.json({
      realBalance: wallet.realBalance,
      demoBalance: wallet.demoBalance,
      settings: { minBet, maxBet, minTopup, maxTopup, gameEnabled: gameEnabled === "true" },
    });
  } catch (err) {
    req.log?.error({ err }, "keno/wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/keno/paytable
kenoRouter.get("/paytable", async (req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(kenoPaytableTable).orderBy(kenoPaytableTable.picks, kenoPaytableTable.hits);
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "keno/paytable error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/topup  — move USDT from main wallet → keno real wallet
kenoRouter.post("/topup", async (req, res) => {
  try {
    const { amount, password } = req.body;
    const userId = (req as any).userId;

    if (!amount || !password) return res.status(400).json({ error: "Amount and password are required" });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

    const [minTopup, maxTopup] = await Promise.all([
      getSetting("min_topup", "1.00").then(parseFloat),
      getSetting("max_topup", "1000.00").then(parseFloat),
    ]);
    if (amt < minTopup) return res.status(400).json({ error: `Minimum top-up is ${minTopup} USDT` });
    if (amt > maxTopup) return res.status(400).json({ error: `Maximum top-up is ${maxTopup} USDT` });

    // Password confirmation (bcrypt + rate limit)
    const pwCheck = await verifyPassword(userId, password);
    if (!pwCheck.ok) return res.status(401).json({ error: pwCheck.error });

    // Atomic: debit main wallet, credit keno wallet, log both
    const result = await db.transaction(async (tx) => {
      // Lock main wallet row
      const mainWalletResult = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${userId} AND asset = 'USDT' FOR UPDATE`
      ) as any;
      const mainWalletRow = mainWalletResult.rows?.[0];
      if (!mainWalletRow) return { error: "Main wallet not found" };

      const avail = parseFloat(mainWalletRow.available_balance);
      if (avail < amt) return { error: "Insufficient balance in main wallet" };

      const newMainBalance = (avail - amt).toFixed(2);

      // Lock / create keno wallet row
      await tx.execute(
        sql`INSERT INTO keno_wallets (user_id, real_balance, demo_balance, updated_at)
            VALUES (${userId}, 0, 10000, NOW())
            ON CONFLICT (user_id) DO NOTHING`
      );

      const kenoResult = await tx.execute(
        sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`
      ) as any;
      const kenoWalletRow = kenoResult.rows?.[0];
      const kenoReal = parseFloat(kenoWalletRow?.real_balance ?? "0");
      const newKenoBalance = (kenoReal + amt).toFixed(2);

      // Debit main wallet
      await tx.update(walletsTable)
        .set({ availableBalance: newMainBalance, updatedAt: new Date() })
        .where(and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT")));

      // Credit keno wallet
      await tx.update(kenoWalletsTable)
        .set({ realBalance: newKenoBalance, updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));

      // Log: debit on main wallet transactions
      await tx.insert(transactionsTable).values({
        userId,
        type: "internal_send",
        amount: amt.toFixed(2),
        status: "completed",
        note: "Keno Top-Up",
      });

      // Log: credit on keno transactions
      await tx.insert(kenoTransactionsTable).values({
        userId,
        type: "topup",
        amount: amt.toFixed(2),
        mode: "real",
        balanceAfter: newKenoBalance,
      });

      return { newKenoBalance, newMainBalance };
    });

    if ("error" in result) return res.status(400).json({ error: result.error });

    res.json({
      success: true,
      kenoBalance: result.newKenoBalance,
      mainBalance: result.newMainBalance,
    });
  } catch (err) {
    req.log?.error({ err }, "keno/topup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/withdraw  — move USDT from keno real wallet → main wallet
kenoRouter.post("/withdraw", async (req, res) => {
  try {
    const { amount, password } = req.body;
    const userId = (req as any).userId;

    if (!amount || !password) return res.status(400).json({ error: "Amount and password are required" });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

    const pwCheck = await verifyPassword(userId, password);
    if (!pwCheck.ok) return res.status(401).json({ error: pwCheck.error });

    const result = await db.transaction(async (tx) => {
      // Lock keno wallet
      const kenoResult = await tx.execute(
        sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`
      ) as any;
      const kenoWalletRow = kenoResult.rows?.[0];
      if (!kenoWalletRow) return { error: "Keno wallet not found" };

      const kenoReal = parseFloat(kenoWalletRow.real_balance);
      if (amt > kenoReal) return { error: "Insufficient Keno wallet balance" };

      const newKenoBalance = (kenoReal - amt).toFixed(2);

      // Lock main wallet
      const mainResult = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${userId} AND asset = 'USDT' FOR UPDATE`
      ) as any;
      const mainWalletRow = mainResult.rows?.[0];
      if (!mainWalletRow) return { error: "Main wallet not found" };

      const mainAvail = parseFloat(mainWalletRow.available_balance);
      const newMainBalance = (mainAvail + amt).toFixed(2);

      // Debit keno wallet
      await tx.update(kenoWalletsTable)
        .set({ realBalance: newKenoBalance, updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));

      // Credit main wallet
      await tx.update(walletsTable)
        .set({ availableBalance: newMainBalance, updatedAt: new Date() })
        .where(and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT")));

      // Log: debit keno
      await tx.insert(kenoTransactionsTable).values({
        userId,
        type: "withdraw",
        amount: amt.toFixed(2),
        mode: "real",
        balanceAfter: newKenoBalance,
      });

      // Log: credit main
      await tx.insert(transactionsTable).values({
        userId,
        type: "internal_receive",
        amount: amt.toFixed(2),
        status: "completed",
        note: "Keno Withdrawal",
      });

      return { newKenoBalance, newMainBalance };
    });

    if ("error" in result) return res.status(400).json({ error: result.error });

    res.json({
      success: true,
      kenoBalance: result.newKenoBalance,
      mainBalance: result.newMainBalance,
    });
  } catch (err) {
    req.log?.error({ err }, "keno/withdraw error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/demo/reset  — reset demo balance to 10,000
kenoRouter.post("/demo/reset", async (req, res) => {
  try {
    const userId = (req as any).userId;
    await db.insert(kenoWalletsTable)
      .values({ userId, demoBalance: "10000.00" })
      .onConflictDoUpdate({
        target: kenoWalletsTable.userId,
        set: { demoBalance: "10000.00", updatedAt: new Date() },
      });
    res.json({ success: true, demoBalance: "10000.00" });
  } catch (err) {
    req.log?.error({ err }, "keno/demo/reset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/play  — play a round
kenoRouter.post("/play", async (req, res) => {
  try {
    await ensureSeeded();
    const userId = (req as any).userId;
    const { picks, betAmount, mode } = req.body;

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10)
      return res.status(400).json({ error: "Select 1–10 numbers" });
    if (picks.some((n: any) => !Number.isInteger(n) || n < 1 || n > 80))
      return res.status(400).json({ error: "Numbers must be integers between 1 and 80" });
    if (new Set(picks).size !== picks.length)
      return res.status(400).json({ error: "Duplicate numbers are not allowed" });
    if (!["demo", "real"].includes(mode))
      return res.status(400).json({ error: "Mode must be 'demo' or 'real'" });

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return res.status(400).json({ error: "Invalid bet amount" });

    const [minBet, maxBet, gameEnabled] = await Promise.all([
      getSetting("min_bet", "0.10").then(parseFloat),
      getSetting("max_bet", "100.00").then(parseFloat),
      getSetting("game_enabled", "true"),
    ]);
    if (gameEnabled !== "true") return res.status(403).json({ error: "Keno is temporarily disabled" });
    if (bet < minBet) return res.status(400).json({ error: `Minimum bet is ${minBet} USDT` });
    if (bet > maxBet) return res.status(400).json({ error: `Maximum bet is ${maxBet} USDT` });

    // ── Draw (crypto.randomInt — non-negotiable) ─────────────────────────────
    const drawn = drawKeno();
    const hitCount = picks.filter((n: number) => drawn.includes(n)).length;

    // ── Paytable lookup ──────────────────────────────────────────────────────
    const ptRow = await db.select({ multiplier: kenoPaytableTable.multiplier })
      .from(kenoPaytableTable)
      .where(and(
        eq(kenoPaytableTable.picks, picks.length),
        eq(kenoPaytableTable.hits, hitCount),
      ))
      .then(r => r[0]);

    const multiplier = parseFloat(ptRow?.multiplier ?? "0");
    const payout = parseFloat((bet * multiplier).toFixed(2));

    // ── Atomic balance update with row lock ──────────────────────────────────
    const result = await db.transaction(async (tx) => {
      // Ensure keno wallet exists
      await tx.execute(
        sql`INSERT INTO keno_wallets (user_id, real_balance, demo_balance, updated_at)
            VALUES (${userId}, 0, 10000, NOW())
            ON CONFLICT (user_id) DO NOTHING`
      );

      const lockResult = await tx.execute(
        sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`
      ) as any;
      const walletRow = lockResult.rows?.[0];

      const balField = mode === "real" ? "real_balance" : "demo_balance";
      const currentBalance = parseFloat(walletRow?.[balField] ?? "0");

      if (currentBalance < bet) return { error: "Insufficient balance" };

      const newBalance = parseFloat((currentBalance - bet + payout).toFixed(2));

      if (mode === "real") {
        await tx.update(kenoWalletsTable)
          .set({ realBalance: String(newBalance), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      } else {
        await tx.update(kenoWalletsTable)
          .set({ demoBalance: String(newBalance), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      }

      // Log round
      const [round] = await tx.insert(kenoRoundsTable).values({
        userId,
        mode,
        picks: picks as number[],
        drawnNumbers: drawn,
        betAmount: bet.toFixed(2),
        hitCount,
        multiplier: multiplier.toFixed(4),
        payoutAmount: payout.toFixed(2),
      }).returning();

      // Log transaction
      await tx.insert(kenoTransactionsTable).values({
        userId,
        type: "bet",
        amount: bet.toFixed(2),
        mode,
        balanceAfter: String(newBalance),
      });

      return { round, newBalance, multiplier, payout, drawn, hitCount };
    });

    if ("error" in result) return res.status(400).json({ error: result.error });

    res.json({
      roundId: result.round?.id,
      drawn: result.drawn,
      picks,
      hitCount: result.hitCount,
      multiplier: result.multiplier,
      payout: result.payout,
      newBalance: result.newBalance,
      mode,
    });
  } catch (err) {
    req.log?.error({ err }, "keno/play error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/keno/history
kenoRouter.get("/history", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
    const mode = req.query.mode as string | undefined;

    const conditions = [eq(kenoRoundsTable.userId, userId)];
    if (mode === "demo" || mode === "real") {
      conditions.push(eq(kenoRoundsTable.mode, mode));
    }

    const rounds = await db.select()
      .from(kenoRoundsTable)
      .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
      .orderBy(desc(kenoRoundsTable.createdAt))
      .limit(limit);

    res.json(rounds);
  } catch (err) {
    req.log?.error({ err }, "keno/history error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ─────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES  (all require adminAuth)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/games/keno/stats
kenoAdminRouter.get("/keno/stats", adminAuth, async (req, res) => {
  try {
    await ensureSeeded();

    const [realRounds, demoRounds, financials, today] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM keno_rounds WHERE mode = 'real'`),
      db.execute(sql`SELECT COUNT(*) as count FROM keno_rounds WHERE mode = 'demo'`),
      db.execute(sql`
        SELECT
          COALESCE(SUM(bet_amount::numeric), 0) AS total_wagered,
          COALESCE(SUM(payout_amount::numeric), 0) AS total_paid_out,
          COALESCE(SUM(bet_amount::numeric) - SUM(payout_amount::numeric), 0) AS house_profit
        FROM keno_rounds WHERE mode = 'real'
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(bet_amount::numeric), 0) AS total_wagered,
          COALESCE(SUM(payout_amount::numeric), 0) AS total_paid_out,
          COALESCE(SUM(bet_amount::numeric) - SUM(payout_amount::numeric), 0) AS house_profit
        FROM keno_rounds WHERE mode = 'real' AND created_at >= NOW() - INTERVAL '1 day'
      `),
    ]);

    const [topups, withdrawals] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM keno_transactions WHERE type = 'topup'`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM keno_transactions WHERE type = 'withdraw'`),
    ]);

    const getRow = (r: any) => (r as any).rows?.[0] ?? (r as any)[0] ?? {};

    res.json({
      realRounds: parseInt(getRow(realRounds).count ?? "0"),
      demoRounds: parseInt(getRow(demoRounds).count ?? "0"),
      allTime: getRow(financials),
      today: getRow(today),
      totalTopups: getRow(topups).total ?? "0",
      totalWithdrawals: getRow(withdrawals).total ?? "0",
    });
  } catch (err) {
    console.error("keno admin stats error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/games/keno/players
kenoAdminRouter.get("/keno/players", adminAuth, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        u.id AS user_id,
        u.username,
        kw.real_balance,
        kw.demo_balance,
        COUNT(CASE WHEN kr.mode = 'real' THEN 1 END) AS real_rounds,
        COUNT(CASE WHEN kr.mode = 'demo' THEN 1 END) AS demo_rounds,
        COALESCE(SUM(CASE WHEN kr.mode = 'real' THEN kr.bet_amount::numeric ELSE 0 END), 0) AS total_wagered,
        COALESCE(SUM(CASE WHEN kr.mode = 'real' THEN kr.payout_amount::numeric ELSE 0 END), 0) AS total_won,
        COALESCE(SUM(CASE WHEN kr.mode = 'real' THEN kr.bet_amount::numeric - kr.payout_amount::numeric ELSE 0 END), 0) AS house_profit
      FROM keno_wallets kw
      JOIN users u ON u.id = kw.user_id
      LEFT JOIN keno_rounds kr ON kr.user_id = kw.user_id
      GROUP BY u.id, u.username, kw.real_balance, kw.demo_balance
      ORDER BY total_wagered DESC
    `);
    res.json((rows as any).rows ?? rows);
  } catch (err) {
    console.error("keno admin players error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/games/keno/player/:userId
kenoAdminRouter.get("/keno/player/:userId", adminAuth, async (req, res) => {
  try {
    const uid = parseInt(req.params.userId);
    const [wallet, rounds, txs] = await Promise.all([
      getOrCreateKenoWallet(uid),
      db.select().from(kenoRoundsTable).where(eq(kenoRoundsTable.userId, uid)).orderBy(desc(kenoRoundsTable.createdAt)).limit(50),
      db.select().from(kenoTransactionsTable).where(eq(kenoTransactionsTable.userId, uid)).orderBy(desc(kenoTransactionsTable.createdAt)).limit(50),
    ]);
    res.json({ wallet, rounds, transactions: txs });
  } catch (err) {
    console.error("keno admin player detail error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/games/keno/paytable
kenoAdminRouter.get("/keno/paytable", adminAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(kenoPaytableTable).orderBy(kenoPaytableTable.picks, kenoPaytableTable.hits);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/games/keno/paytable  — body: [{ picks, hits, multiplier }]
kenoAdminRouter.put("/keno/paytable", adminAuth, async (req, res) => {
  try {
    const entries: Array<{ picks: number; hits: number; multiplier: string }> = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: "Expected array" });

    for (const e of entries) {
      await db.update(kenoPaytableTable)
        .set({ multiplier: String(parseFloat(e.multiplier).toFixed(4)) })
        .where(and(eq(kenoPaytableTable.picks, e.picks), eq(kenoPaytableTable.hits, e.hits)));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/games/keno/settings
kenoAdminRouter.get("/keno/settings", adminAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(kenoSettingsTable);
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/games/keno/settings  — body: { key: value, ... }
kenoAdminRouter.put("/keno/settings", adminAuth, async (req, res) => {
  try {
    const updates: Record<string, string> = req.body;
    const allowed = ["game_enabled", "min_bet", "max_bet", "min_topup", "max_topup"];
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      await db.insert(kenoSettingsTable)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({
          target: kenoSettingsTable.key,
          set: { value: String(value), updatedAt: new Date() },
        });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});
