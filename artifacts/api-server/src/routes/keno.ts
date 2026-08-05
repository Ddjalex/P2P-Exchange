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
import { randomInt, createHmac, timingSafeEqual, randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  kenoWalletsTable,
  kenoTransactionsTable,
  kenoPaytableTable,
  kenoRoundsTable,
  kenoSettingsTable,
  kenoBatchesTable,
  walletsTable,
  transactionsTable,
  usersTable,
  platformWalletTable,
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

// ─── GLI-11 Provably Fair Draw Engine ────────────────────────────────────────
//
// Architecture (3-step commitment scheme):
//
//  1. PRE-ROUND  — generate serverSeed (32-byte OS entropy), compute
//                  serverHash = SHA-256(serverSeed | roundId | timestamp).
//                  Publish serverHash to clients BEFORE betting opens.
//
//  2. AT DRAW    — record drawTimestamp, run deterministic Fisher-Yates
//                  seeded by HMAC-SHA256(serverSeed, roundId:drawTimestamp:i)
//                  for each swap step i.  The draw is fully reproducible
//                  by anyone who knows serverSeed + roundId + drawTimestamp.
//
//  3. POST-DRAW  — reveal serverSeed in the API response.  Players can
//                  independently verify: SHA-256(seed|id|ts) === serverHash
//                  AND reproduce the exact 20-number sequence.
//
// Entropy source: Node.js crypto.randomBytes() — OS CSPRNG (satisfies
// GLI-11 §6.1 "approved entropy source" requirement).
// Shuffle:        HMAC-SHA256 Fisher-Yates — each swap index is derived
//                 from a keyed hash, never from Math.random().

/** Step 1 — generate a fresh server seed at round creation. */
function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** Step 1 — SHA-256 commitment published to clients before betting. */
function computeServerHash(serverSeed: string, roundId: number, timestamp: number): string {
  return createHash("sha256")
    .update(`${serverSeed}|${roundId}|${timestamp}`)
    .digest("hex");
}

/**
 * Step 2 — Deterministic Fisher-Yates shuffle seeded by HMAC-SHA256.
 *
 * For each swap step i (79 → 1) we compute:
 *   h = HMAC-SHA256(key=serverSeed, data=`${roundId}:${drawTimestamp}:${i}`)
 *   j = readUInt32BE(h[0..3]) % (i + 1)          // mod bias < 2^{-23}, acceptable
 *   swap pool[i] ↔ pool[j]
 *
 * Reproducible: same inputs always yield the same 20 numbers.
 */
function deriveProvablyFairDraw(serverSeed: string, roundId: number, drawTimestamp: number): number[] {
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const h = createHmac("sha256", serverSeed)
      .update(`${roundId}:${drawTimestamp}:${i}`)
      .digest();
    const j = h.readUInt32BE(0) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Return in raw shuffle order — the frontend animates tiles in this exact
  // sequence so they light up randomly across the grid, not top-to-bottom.
  return pool.slice(0, 20);
}

// ─── Multiplayer Round Manager ────────────────────────────────────────────────
//
// One shared game round for ALL players.
// Cycle: 30 s betting → draw → 14.5 s drawing phase → repeat.
// The TOTAL stake for a user's entire batch is debited in ONE atomic SQL
// command before the draw; total winnings are credited in ONE atomic SQL
// command after evaluation.

const BETTING_MS = 30_000;  // 30-second betting window
const DRAWING_MS =  7_000;  // 20 balls × 150 ms animation + ~4 s result display

// ── Batch / ticket types ──────────────────────────────────────────────────────

interface PendingTicket {
  picks:     number[];
  betAmount: string;  // per-ticket stake
}

/** One user's queued entry for the current multiplayer round (1–10 tickets). */
interface PendingBatch {
  userId:                number;
  tickets:               PendingTicket[];
  totalStaked:           string;          // sum of all ticket bets
  mode:                  "demo" | "real";
  balanceAfterDeduction: number;
}

interface SettledTicketResult {
  picks:      number[];
  betAmount:  string;
  matches:    number[];   // actual intersecting numbers
  hitCount:   number;
  multiplier: number;
  payout:     number;
  isWin:      boolean;
}

/** Settlement result stored in activeRound.results keyed by `${userId}:${mode}`. */
interface SettledBatchResult {
  tickets:     SettledTicketResult[];
  totalPayout: number;
  mode:        "demo" | "real";
  newBalance:  number;
}

interface GameRound {
  roundId:          number;
  phase:            "betting" | "drawing";
  bettingEndsAt:    number;          // epoch ms
  drawingEndsAt:    number | null;
  drawnNumbers:     number[] | null;
  // ── Provably Fair fields ──────────────────────────────────────────────────
  serverSeed:       string;          // secret until revealed after draw
  serverHash:       string;          // SHA-256(seed|roundId|seedTimestamp) — published before betting
  seedTimestamp:    number;          // timestamp used in hash (published with serverHash)
  drawTimestamp:    number | null;   // set at draw time; revealed with serverSeed
  serverSeedRevealed: string | null; // null during betting; set to serverSeed after draw
  bets:             Map<string, PendingBatch>;      // `${userId}:${mode}`
  results:          Map<string, SettledBatchResult>; // `${userId}:${mode}`
}

// ── Batch evaluator ───────────────────────────────────────────────────────────
//
// Evaluates every ticket in a batch against the already-drawn numbers.
// Returns per-ticket results; does NOT touch the database (pure computation +
// paytable lookup).

async function evaluateUserBatch(
  tickets: PendingTicket[],
  drawn: number[],
): Promise<SettledTicketResult[]> {
  const drawnSet = new Set(drawn);

  // Fetch all required paytable entries in a single query to avoid N round-trips
  const paytableRows = await db.select({
    picks: kenoPaytableTable.picks,
    hits:  kenoPaytableTable.hits,
    multiplier: kenoPaytableTable.multiplier,
  }).from(kenoPaytableTable);

  const ptMap = new Map<string, number>();
  for (const row of paytableRows) {
    ptMap.set(`${row.picks}:${row.hits}`, parseFloat(row.multiplier));
  }

  return tickets.map(ticket => {
    const betAmt   = parseFloat(ticket.betAmount);
    const matches  = ticket.picks.filter(n => drawnSet.has(n));
    const hitCount = matches.length;
    const multiplier = ptMap.get(`${ticket.picks.length}:${hitCount}`) ?? 0;
    const payout     = parseFloat((betAmt * multiplier).toFixed(2));
    return { picks: ticket.picks, betAmount: ticket.betAmount, matches, hitCount, multiplier, payout, isWin: payout > 0 };
  });
}

let _roundCounter = 1;

function makeRound(): GameRound {
  const roundId       = _roundCounter++;
  const serverSeed    = generateServerSeed();
  const seedTimestamp = Date.now();
  const serverHash    = computeServerHash(serverSeed, roundId, seedTimestamp);
  return {
    roundId,
    phase:              "betting",
    bettingEndsAt:      seedTimestamp + BETTING_MS,
    drawingEndsAt:      null,
    drawnNumbers:       null,
    serverSeed,
    serverHash,
    seedTimestamp,
    drawTimestamp:      null,
    serverSeedRevealed: null,
    bets:               new Map(),
    results:            new Map(),
  };
}

let activeRound: GameRound = makeRound();

async function advanceRound() {
  if (activeRound.phase !== "betting") return;

  // Provably fair draw: deterministic from committed seed
  const drawTimestamp = Date.now();
  activeRound.drawTimestamp = drawTimestamp;
  const drawn = deriveProvablyFairDraw(activeRound.serverSeed, activeRound.roundId, drawTimestamp);

  // Settle every pending batch BEFORE flipping to "drawing" so the first
  // client poll that sees phase==="drawing" already has results.
  const batches = Array.from(activeRound.bets.values());
  await Promise.allSettled(batches.map(batch => settleUserBatch(batch, drawn)));

  // Reveal the server seed now that the draw is locked in
  activeRound.serverSeedRevealed = activeRound.serverSeed;

  activeRound.phase         = "drawing";
  activeRound.drawnNumbers  = drawn;
  activeRound.drawingEndsAt = Date.now() + DRAWING_MS;

  // Start next betting round after the drawing window closes
  setTimeout(() => {
    activeRound = makeRound();
    setTimeout(advanceRound, BETTING_MS);
  }, DRAWING_MS);
}

// ── settleUserBatch ───────────────────────────────────────────────────────────
//
// Called at round end for every queued batch (1–10 tickets per user).
// Evaluates all tickets against the shared draw, then:
//   • Credits TOTAL_PAYOUT in ONE atomic SQL UPDATE (SELECT … FOR UPDATE)
//   • Inserts one keno_batches row + N keno_rounds rows + one keno_transactions row

async function settleUserBatch(batch: PendingBatch, drawn: number[]): Promise<void> {
  const { userId, tickets, totalStaked, mode } = batch;

  // Evaluate all tickets against the draw (pure computation + paytable lookup)
  const ticketResults = await evaluateUserBatch(tickets, drawn);
  const totalPayout = parseFloat(
    ticketResults.reduce((sum, r) => sum + r.payout, 0).toFixed(2),
  );

  // Atomic: credit total payout, log batch + individual rounds in one transaction
  const settleRes = await db.transaction(async tx => {
    const lock = await tx.execute(
      sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`,
    ) as any;
    const row = lock.rows?.[0];
    if (!row) return { error: "wallet missing" } as const;

    const field  = mode === "real" ? "real_balance" : "demo_balance";
    const cur    = parseFloat(row[field] ?? "0");
    const newBal = parseFloat((cur + totalPayout).toFixed(2));

    // ONE balance update for the whole batch
    if (totalPayout > 0) {
      if (mode === "real") {
        await tx.update(kenoWalletsTable)
          .set({ realBalance: String(newBal), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      } else {
        await tx.update(kenoWalletsTable)
          .set({ demoBalance: String(newBal), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      }
    }

    // Batch-level record
    const [batchRow] = await tx.insert(kenoBatchesTable).values({
      userId, mode,
      drawnNumbers: drawn,
      totalStaked,
      totalPayout: totalPayout.toFixed(2),
      ticketCount: tickets.length,
      status: "settled",
      settledAt: new Date(),
    }).returning({ id: kenoBatchesTable.id });

    // Individual ticket records
    for (const r of ticketResults) {
      await tx.insert(kenoRoundsTable).values({
        userId, mode,
        batchId: batchRow.id,
        picks: r.picks,
        drawnNumbers: drawn,
        betAmount: r.betAmount,
        hitCount: r.hitCount,
        multiplier: r.multiplier.toFixed(4),
        payoutAmount: r.payout.toFixed(2),
      });
    }

    // ONE transaction log entry covering the whole stake
    await tx.insert(kenoTransactionsTable).values({
      userId, type: "bet", amount: totalStaked, mode,
      balanceAfter: String(newBal),
    });

    return { newBalance: newBal };
  });

  if ("error" in settleRes) return;

  activeRound.results.set(`${userId}:${mode}`, {
    tickets: ticketResults,
    totalPayout,
    mode,
    newBalance: settleRes.newBalance,
  });
}

// Kick off the first round immediately on server start
setTimeout(advanceRound, BETTING_MS);

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

// GET /api/games/keno/state  — current shared round state (multiplayer)
kenoRouter.get("/state", (req, res) => {
  try {
    const userId = (req as any).userId;
    const now    = Date.now();
    const round  = activeRound;

    const secondsLeft = round.phase === "betting"
      ? Math.max(0, Math.ceil((round.bettingEndsAt - now) / 1000))
      : 0;

    const betKeyDemo = `${userId}:demo`;
    const betKeyReal = `${userId}:real`;
    const myBatch  = round.bets.get(betKeyDemo) ?? round.bets.get(betKeyReal);
    const myResult = round.results.get(betKeyDemo) ?? round.results.get(betKeyReal);

    // Build myBatch response (supports 1–10 tickets per user)
    const myBatchOut = myBatch ? {
      mode:        myBatch.mode,
      totalStaked: myBatch.totalStaked,
      ticketCount: myBatch.tickets.length,
      tickets:     myBatch.tickets.map(t => ({
        picks:     t.picks,
        betAmount: t.betAmount,
      })),
      ...(myResult ? {
        drawnNumbers: round.drawnNumbers,
        totalPayout:  myResult.totalPayout,
        newBalance:   myResult.newBalance,
        tickets: myResult.tickets.map(r => ({
          picks:      r.picks,
          matches:    r.matches,
          betAmount:  r.betAmount,
          hitCount:   r.hitCount,
          multiplier: r.multiplier,
          payout:     r.payout,
          isWin:      r.isWin,
        })),
        summary: {
          totalBet:      parseFloat(myBatch!.totalStaked),
          totalWinnings: parseFloat(myResult.totalPayout.toFixed(2)),
          netChange:     parseFloat((myResult.totalPayout - parseFloat(myBatch!.totalStaked)).toFixed(2)),
          newBalance:    myResult.newBalance,
        },
      } : {}),
    } : null;

    res.json({
      roundId:      round.roundId,
      phase:        round.phase,
      secondsLeft,
      totalBets:    round.bets.size,
      drawnNumbers: round.drawnNumbers,
      myBatch:      myBatchOut,
      // ── Provably Fair fields ─────────────────────────────────────────────
      // serverHash is published during betting so players can verify the draw
      // was not altered after they placed their bets.
      serverHash:          round.serverHash,
      seedTimestamp:       round.seedTimestamp,
      // serverSeedRevealed is null during betting; set to the actual seed
      // once the draw is locked in — players can verify:
      //   SHA-256(serverSeedRevealed + "|" + roundId + "|" + seedTimestamp) === serverHash
      serverSeedRevealed:  round.serverSeedRevealed,
      drawTimestamp:       round.drawTimestamp,
      status:              round.phase === "drawing" ? "SETTLED" : "OPEN",
    });
  } catch (err) {
    req.log?.error({ err }, "keno/state error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Shared helper: atomically deduct TOTAL_STAKED before a multiplayer round ─

async function deductBatchStake(
  userId: number,
  mode: "demo" | "real",
  totalStaked: number,
): Promise<{ balanceAfterDeduction: number } | { error: string }> {
  return db.transaction(async tx => {
    await tx.execute(
      sql`INSERT INTO keno_wallets (user_id, real_balance, demo_balance, updated_at)
          VALUES (${userId}, 0, 10000, NOW())
          ON CONFLICT (user_id) DO NOTHING`,
    );
    const lock = await tx.execute(
      sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`,
    ) as any;
    const row   = lock.rows?.[0];
    const field = mode === "real" ? "real_balance" : "demo_balance";
    const cur   = parseFloat(row?.[field] ?? "0");
    if (cur < totalStaked) return { error: "Insufficient balance" } as const;
    const after = parseFloat((cur - totalStaked).toFixed(2));
    if (mode === "real") {
      await tx.update(kenoWalletsTable)
        .set({ realBalance: String(after), updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));
    } else {
      await tx.update(kenoWalletsTable)
        .set({ demoBalance: String(after), updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));
    }
    return { balanceAfterDeduction: after };
  });
}

// ── Shared helper: refund TOTAL_STAKED if round closed during DB round-trip ──

async function refundBatchStake(userId: number, mode: "demo" | "real", totalStaked: number) {
  db.transaction(async tx => {
    const lock = await tx.execute(
      sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`,
    ) as any;
    const row   = lock.rows?.[0];
    const field = mode === "real" ? "real_balance" : "demo_balance";
    const cur   = parseFloat(row?.[field] ?? "0");
    const refunded = parseFloat((cur + totalStaked).toFixed(2));
    if (mode === "real") {
      await tx.update(kenoWalletsTable)
        .set({ realBalance: String(refunded), updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));
    } else {
      await tx.update(kenoWalletsTable)
        .set({ demoBalance: String(refunded), updatedAt: new Date() })
        .where(eq(kenoWalletsTable.userId, userId));
    }
  }).catch(e => console.error("[Keno] refund failed", e));
}

// POST /api/games/keno/bet  — place a SINGLE-ticket bet for the current shared round
// (kept for backward compatibility; internally treated as a 1-ticket batch)
kenoRouter.post("/bet", async (req, res) => {
  try {
    await ensureSeeded();
    const userId = (req as any).userId;
    const { picks, betAmount, mode } = req.body;

    if (activeRound.phase !== "betting")
      return res.status(400).json({ error: "Betting is closed — wait for the next round" });

    if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10)
      return res.status(400).json({ error: "Select 1–10 numbers" });
    if (picks.some((n: any) => !Number.isInteger(n) || n < 1 || n > 80))
      return res.status(400).json({ error: "Numbers must be integers 1–80" });
    if (new Set(picks).size !== picks.length)
      return res.status(400).json({ error: "Duplicate numbers not allowed" });
    if (!["demo", "real"].includes(mode))
      return res.status(400).json({ error: "Invalid mode" });

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return res.status(400).json({ error: "Invalid bet amount" });

    const betKey = `${userId}:${mode}`;
    if (activeRound.bets.has(betKey))
      return res.status(400).json({ error: "You already placed a bet this round" });

    // Claim the slot immediately — prevents concurrent requests from both
    // passing the has() check above before either finishes the DB deduction.
    const claimedRoundId = activeRound.roundId;
    activeRound.bets.set(betKey, null as any);

    const [minBet, maxBet, gameEnabled] = await Promise.all([
      getSetting("min_bet", "0.10").then(parseFloat),
      getSetting("max_bet", "100.00").then(parseFloat),
      getSetting("game_enabled", "true"),
    ]);
    if (gameEnabled !== "true") {
      activeRound.bets.delete(betKey);
      return res.status(403).json({ error: "Keno is temporarily disabled" });
    }
    if (bet < minBet) {
      activeRound.bets.delete(betKey);
      return res.status(400).json({ error: `Minimum bet is ${minBet} USDT` });
    }
    if (bet > maxBet) {
      activeRound.bets.delete(betKey);
      return res.status(400).json({ error: `Maximum bet is ${maxBet} USDT` });
    }

    // Deduct TOTAL_STAKED in ONE atomic SQL command before the draw
    const deductRes = await deductBatchStake(userId, mode as "demo" | "real", bet);
    if ("error" in deductRes) {
      activeRound.bets.delete(betKey);
      return res.status(400).json({ error: deductRes.error });
    }

    // Race: round closed while the DB transaction was in flight — refund and reject
    if (activeRound.phase !== "betting" || activeRound.roundId !== claimedRoundId) {
      activeRound.bets.delete(betKey);
      await refundBatchStake(userId, mode as "demo" | "real", bet);
      return res.status(400).json({ error: "Betting just closed — your balance was refunded" });
    }

    // Register as a 1-ticket batch so settlement uses the shared batch path
    activeRound.bets.set(betKey, {
      userId,
      tickets: [{ picks, betAmount: bet.toFixed(2) }],
      totalStaked: bet.toFixed(2),
      mode: mode as "demo" | "real",
      balanceAfterDeduction: deductRes.balanceAfterDeduction,
    });

    res.json({
      success:               true,
      roundId:               activeRound.roundId,
      picks,
      betAmount:             bet.toFixed(2),
      mode,
      balanceAfterDeduction: deductRes.balanceAfterDeduction,
    });
  } catch (err) {
    req.log?.error({ err }, "keno/bet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/bet-batch  — add 1 ticket to the current shared round.
// Users may call this up to MAX_TICKETS_PER_ROUND times per round; each call
// appends one ticket and deducts only that ticket's stake immediately.
const MAX_TICKETS_PER_ROUND = 20;

kenoRouter.post("/bet-batch", async (req, res) => {
  try {
    await ensureSeeded();
    const userId = (req as any).userId;

    let tickets: unknown;
    let mode: unknown;
    try { ({ tickets, mode } = req.body); } catch {
      return res.status(400).json({ error: "Invalid request body" });
    }

    if (activeRound.phase !== "betting")
      return res.status(400).json({ error: "Betting is closed — wait for the next round" });

    if (!["demo", "real"].includes(mode as string))
      return res.status(400).json({ error: "Invalid mode" });

    if (!Array.isArray(tickets) || tickets.length !== 1)
      return res.status(400).json({ error: "Submit exactly 1 ticket per request" });

    const betKey = `${userId}:${mode}`;

    // Snapshot the existing batch (may be undefined for first ticket)
    const existingBatch = activeRound.bets.get(betKey) as PendingBatch | null | undefined;

    // Check per-round ticket cap
    const existingCount = existingBatch?.tickets?.length ?? 0;
    if (existingCount >= MAX_TICKETS_PER_ROUND) {
      return res.status(400).json({ error: `Maximum ${MAX_TICKETS_PER_ROUND} tickets per round` });
    }

    // Claim / lock the slot to prevent duplicate concurrent requests
    const claimedRoundId = activeRound.roundId;
    activeRound.bets.set(betKey, null as any);

    const [minBet, maxBet, gameEnabled] = await Promise.all([
      getSetting("min_bet", "0.10").then(parseFloat),
      getSetting("max_bet", "100.00").then(parseFloat),
      getSetting("game_enabled", "true"),
    ]);
    if (gameEnabled !== "true") {
      // Restore previous batch state on error
      if (existingBatch != null) activeRound.bets.set(betKey, existingBatch);
      else activeRound.bets.delete(betKey);
      return res.status(403).json({ error: "Keno is temporarily disabled" });
    }

    // Validate the single ticket
    const raw = (tickets as any[])[0] ?? {};
    const { picks, betAmount: rawBet } = raw;

    const restore = () => {
      if (existingBatch != null) activeRound.bets.set(betKey, existingBatch);
      else activeRound.bets.delete(betKey);
    };

    if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10) {
      restore(); return res.status(400).json({ error: "Select 1–10 numbers per ticket" });
    }
    if (picks.some((n: any) => !Number.isInteger(n) || n < 1 || n > 80)) {
      restore(); return res.status(400).json({ error: "Numbers must be integers 1–80" });
    }
    if (new Set(picks).size !== picks.length) {
      restore(); return res.status(400).json({ error: "Duplicate numbers not allowed" });
    }
    const bet = parseFloat(rawBet);
    if (isNaN(bet) || bet <= 0) {
      restore(); return res.status(400).json({ error: "Invalid bet amount" });
    }
    if (bet < minBet) {
      restore(); return res.status(400).json({ error: `Minimum bet is ${minBet} USDT` });
    }
    if (bet > maxBet) {
      restore(); return res.status(400).json({ error: `Maximum bet is ${maxBet} USDT` });
    }

    const newTicket: PendingTicket = { picks, betAmount: bet.toFixed(2) };

    // Deduct only this ticket's stake atomically
    const deductRes = await deductBatchStake(userId, mode as "demo" | "real", bet);
    if ("error" in deductRes) {
      restore(); return res.status(400).json({ error: deductRes.error });
    }

    // Race: round closed during the DB transaction — refund and reject
    if (activeRound.phase !== "betting" || activeRound.roundId !== claimedRoundId) {
      restore();
      await refundBatchStake(userId, mode as "demo" | "real", bet);
      return res.status(400).json({ error: "Betting just closed — your balance was refunded" });
    }

    // Merge new ticket into (possibly existing) batch
    const prevTickets = existingBatch?.tickets ?? [];
    const prevStaked  = parseFloat(existingBatch?.totalStaked ?? "0");
    const allTickets  = [...prevTickets, newTicket];
    const totalStaked = parseFloat((prevStaked + bet).toFixed(2));

    activeRound.bets.set(betKey, {
      userId,
      tickets:               allTickets,
      totalStaked:           totalStaked.toFixed(2),
      mode:                  mode as "demo" | "real",
      balanceAfterDeduction: deductRes.balanceAfterDeduction,
    });

    res.json({
      success:               true,
      roundId:               activeRound.roundId,
      mode,
      ticketCount:           allTickets.length,
      totalStaked:           totalStaked.toFixed(2),
      balanceAfterDeduction: deductRes.balanceAfterDeduction,
      tickets: allTickets.map(t => ({ picks: t.picks, betAmount: t.betAmount })),
    });
  } catch (err) {
    req.log?.error({ err }, "keno/bet-batch error");
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

    // ── Provably fair instant draw ───────────────────────────────────────────
    const instantSeed      = generateServerSeed();
    const instantTimestamp = Date.now();
    const instantHash      = computeServerHash(instantSeed, 0, instantTimestamp);
    const drawn            = deriveProvablyFairDraw(instantSeed, 0, instantTimestamp);
    const drawnSet = new Set(drawn);
    const matches = (picks as number[]).filter(n => drawnSet.has(n));
    const hitCount = matches.length;

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
      roundId:           result.round?.id,
      serverHash:        instantHash,
      serverSeedRevealed: instantSeed,
      drawTimestamp:     instantTimestamp,
      status:            "SETTLED",
      drawnNumbers: result.drawn,
      tickets: [{
        ticketId:   result.round?.id,
        picks,
        matches,
        hitCount:   result.hitCount,
        betAmount:  parseFloat(bet.toFixed(2)),
        multiplier: result.multiplier,
        payout:     result.payout,
        isWin:      result.payout > 0,
      }],
      summary: {
        totalBet:      parseFloat(bet.toFixed(2)),
        totalWinnings: parseFloat(result.payout.toFixed(2)),
        netChange:     parseFloat((result.payout - bet).toFixed(2)),
        newBalance:    result.newBalance,
      },
      mode,
    });
  } catch (err) {
    req.log?.error({ err }, "keno/play error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/keno/play-batch  — instant-play with 1–10 tickets sharing ONE draw
//
// Atomic guarantee:
//   1. Validate all tickets and compute TOTAL_BET.
//   2. SELECT … FOR UPDATE the keno wallet; ROLLBACK if balance < TOTAL_BET.
//   3. Generate EXACTLY ONE draw with crypto.randomInt (Fisher-Yates).
//   4. Evaluate every ticket against that draw.
//   5. Credit TOTAL_PAYOUT in ONE UPDATE inside the same transaction.
//   6. Insert one keno_batches row + N keno_rounds rows + one keno_transactions row.

kenoRouter.post("/play-batch", async (req, res) => {
  try {
    await ensureSeeded();
    const userId = (req as any).userId;

    let tickets: unknown;
    let mode: unknown;
    try { ({ tickets, mode } = req.body); } catch {
      return res.status(400).json({ error: "Invalid request body" });
    }

    if (!["demo", "real"].includes(mode as string))
      return res.status(400).json({ error: "Mode must be 'demo' or 'real'" });
    if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 10)
      return res.status(400).json({ error: "Submit 1–10 tickets per batch" });

    const [minBet, maxBet, gameEnabled] = await Promise.all([
      getSetting("min_bet", "0.10").then(parseFloat),
      getSetting("max_bet", "100.00").then(parseFloat),
      getSetting("game_enabled", "true"),
    ]);
    if (gameEnabled !== "true") return res.status(403).json({ error: "Keno is temporarily disabled" });

    // ── Validate every ticket, accumulate TOTAL_BET ──────────────────────────
    let totalStaked = 0;
    const validatedTickets: PendingTicket[] = [];
    for (const [i, raw] of (tickets as any[]).entries()) {
      try {
        const { picks, betAmount: rawBet } = raw ?? {};
        if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10)
          return res.status(400).json({ error: `Ticket ${i + 1}: select 1–10 numbers` });
        if (picks.some((n: any) => !Number.isInteger(n) || n < 1 || n > 80))
          return res.status(400).json({ error: `Ticket ${i + 1}: numbers must be integers 1–80` });
        if (new Set(picks).size !== picks.length)
          return res.status(400).json({ error: `Ticket ${i + 1}: duplicate numbers not allowed` });
        const bet = parseFloat(rawBet);
        if (isNaN(bet) || bet <= 0)
          return res.status(400).json({ error: `Ticket ${i + 1}: invalid bet amount` });
        if (bet < minBet)
          return res.status(400).json({ error: `Ticket ${i + 1}: minimum bet is ${minBet} USDT` });
        if (bet > maxBet)
          return res.status(400).json({ error: `Ticket ${i + 1}: maximum bet is ${maxBet} USDT` });
        totalStaked += bet;
        validatedTickets.push({ picks, betAmount: bet.toFixed(2) });
      } catch {
        return res.status(400).json({ error: `Ticket ${i + 1}: malformed` });
      }
    }
    totalStaked = parseFloat(totalStaked.toFixed(2));

    // ── Provably fair instant-batch draw ─────────────────────────────────────
    const batchSeed      = generateServerSeed();
    const batchTimestamp = Date.now();
    const batchHash      = computeServerHash(batchSeed, 0, batchTimestamp);
    const drawn          = deriveProvablyFairDraw(batchSeed, 0, batchTimestamp);

    // ── Evaluate all tickets against the single draw ──────────────────────────
    const ticketResults = await evaluateUserBatch(validatedTickets, drawn);
    const totalPayout = parseFloat(
      ticketResults.reduce((sum, r) => sum + r.payout, 0).toFixed(2),
    );

    // ── Atomic: check balance ≥ TOTAL_BET, deduct stake, credit payout ────────
    const result = await db.transaction(async tx => {
      // Ensure keno wallet exists
      await tx.execute(
        sql`INSERT INTO keno_wallets (user_id, real_balance, demo_balance, updated_at)
            VALUES (${userId}, 0, 10000, NOW())
            ON CONFLICT (user_id) DO NOTHING`,
      );

      const lockResult = await tx.execute(
        sql`SELECT * FROM keno_wallets WHERE user_id = ${userId} FOR UPDATE`,
      ) as any;
      const walletRow = lockResult.rows?.[0];

      const balField = mode === "real" ? "real_balance" : "demo_balance";
      const currentBalance = parseFloat(walletRow?.[balField] ?? "0");

      // ROLLBACK immediately if balance < TOTAL_BET (zero-state execution)
      if (currentBalance < totalStaked)
        return { error: "Insufficient balance — TOTAL_BET exceeds your current balance" } as const;

      // Net balance = current − TOTAL_BET + TOTAL_PAYOUT (one UPDATE)
      const newBalance = parseFloat((currentBalance - totalStaked + totalPayout).toFixed(2));

      if (mode === "real") {
        await tx.update(kenoWalletsTable)
          .set({ realBalance: String(newBalance), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      } else {
        await tx.update(kenoWalletsTable)
          .set({ demoBalance: String(newBalance), updatedAt: new Date() })
          .where(eq(kenoWalletsTable.userId, userId));
      }

      // Batch-level record (provably-fair: entropyData = SHA-256 of the raw nonce)
      const nonce = randomBytes(16).toString("hex");
      const entropyData = createHash("sha256").update(nonce).digest("hex");

      const [batchRow] = await tx.insert(kenoBatchesTable).values({
        userId,
        mode: mode as string,
        drawnNumbers: drawn,
        entropyData,
        totalStaked: totalStaked.toFixed(2),
        totalPayout: totalPayout.toFixed(2),
        ticketCount: validatedTickets.length,
        status: "settled",
        settledAt: new Date(),
      }).returning({ id: kenoBatchesTable.id });

      // Insert one keno_rounds row per ticket
      for (const r of ticketResults) {
        await tx.insert(kenoRoundsTable).values({
          userId,
          mode: mode as string,
          batchId: batchRow.id,
          picks: r.picks,
          drawnNumbers: drawn,
          betAmount: r.betAmount,
          hitCount: r.hitCount,
          multiplier: r.multiplier.toFixed(4),
          payoutAmount: r.payout.toFixed(2),
        });
      }

      // ONE keno_transactions entry for the whole batch stake
      await tx.insert(kenoTransactionsTable).values({
        userId,
        type: "bet",
        amount: totalStaked.toFixed(2),
        mode: mode as string,
        balanceAfter: String(newBalance),
      });

      return { batchId: batchRow.id, newBalance, entropyData };
    });

    if ("error" in result) return res.status(400).json({ error: result.error });

    res.json({
      batchId:           result.batchId,
      serverHash:        batchHash,
      serverSeedRevealed: batchSeed,
      drawTimestamp:     batchTimestamp,
      status:            "SETTLED",
      drawnNumbers: drawn,
      entropyData:  result.entropyData,
      mode,
      tickets: ticketResults.map((r, i) => ({
        ticketIndex: i + 1,
        picks:       r.picks,
        matches:     r.matches,
        hitCount:    r.hitCount,
        betAmount:   parseFloat(r.betAmount),
        multiplier:  r.multiplier,
        payout:      r.payout,
        isWin:       r.isWin,
      })),
      summary: {
        totalBet:      parseFloat(totalStaked.toFixed(2)),
        totalWinnings: parseFloat(totalPayout.toFixed(2)),
        netChange:     parseFloat((totalPayout - totalStaked).toFixed(2)),
        newBalance:    result.newBalance,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "keno/play-batch error");
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

// GET /api/games/keno/rounds  — global draw history (all users, no auth needed)
kenoRouter.get("/rounds", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
    // One row per distinct multiplayer round, ordered by round_id descending so
    // the displayed "Draw #N" exactly matches the in-game round counter.
    const rows = await db.execute(sql`
      SELECT
        round_id,
        drawn_numbers,
        MAX(settled_at) AS drawn_at
      FROM keno_batches
      WHERE round_id IS NOT NULL
        AND status = 'settled'
        AND drawn_numbers IS NOT NULL
      GROUP BY round_id, drawn_numbers
      ORDER BY round_id DESC
      LIMIT ${limit}
    `);
    res.json(rows.rows.map((r: any) => ({
      roundId:      r.round_id as number,
      drawnNumbers: r.drawn_numbers as number[],
      drawnAt:      r.drawn_at,
    })));
  } catch (err) {
    req.log?.error({ err }, "keno/rounds error");
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

    const [topups, withdrawals, mergedSetting, platformRow] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM keno_transactions WHERE type = 'topup'`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM keno_transactions WHERE type = 'withdraw'`),
      db.select().from(kenoSettingsTable).where(eq(kenoSettingsTable.key, 'merged_profit')).then(r => r[0]),
      db.execute(sql`SELECT total_collected FROM platform_wallet WHERE asset = 'USDT' LIMIT 1`),
    ]);

    const getRow = (r: any) => (r as any).rows?.[0] ?? (r as any)[0] ?? {};

    res.json({
      realRounds: parseInt(getRow(realRounds).count ?? "0"),
      demoRounds: parseInt(getRow(demoRounds).count ?? "0"),
      allTime: getRow(financials),
      today: getRow(today),
      totalTopups: getRow(topups).total ?? "0",
      totalWithdrawals: getRow(withdrawals).total ?? "0",
      mergedProfit: mergedSetting?.value ?? "0",
      platformCollected: getRow(platformRow).total_collected ?? "0",
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

// POST /api/admin/games/keno/merge-profit — transfer accumulated house profit to platform wallet
kenoAdminRouter.post("/keno/merge-profit", adminAuth, async (req, res) => {
  try {
    await ensureSeeded();

    // Total house profit across all real rounds
    const profitResult = await db.execute(sql`
      SELECT COALESCE(SUM(bet_amount::numeric) - SUM(payout_amount::numeric), 0) AS house_profit
      FROM keno_rounds WHERE mode = 'real'
    `);
    const houseProfit = parseFloat(((profitResult as any).rows?.[0] ?? (profitResult as any)[0])?.house_profit ?? "0");

    // How much was already merged in previous calls
    const mergedRow = await db.select().from(kenoSettingsTable).where(eq(kenoSettingsTable.key, 'merged_profit')).then(r => r[0]);
    const alreadyMerged = parseFloat(mergedRow?.value ?? "0");

    const toMerge = houseProfit - alreadyMerged;
    if (toMerge <= 0) {
      return res.json({ success: true, merged: 0, message: "No new profit to merge" });
    }

    // Add the delta to the platform wallet
    await db.execute(sql`
      UPDATE platform_wallet
      SET total_collected = total_collected + ${toMerge.toFixed(8)}, updated_at = NOW()
      WHERE asset = 'USDT'
    `);

    // Record the new watermark so next merge only takes the delta
    await db.insert(kenoSettingsTable)
      .values({ key: 'merged_profit', value: String(houseProfit) })
      .onConflictDoUpdate({
        target: kenoSettingsTable.key,
        set: { value: String(houseProfit), updatedAt: new Date() },
      });

    res.json({ success: true, merged: toMerge });
  } catch (err) {
    console.error("keno merge profit error", err);
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
