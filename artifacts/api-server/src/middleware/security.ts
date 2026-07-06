import { db } from "@workspace/db";
import { transactionsTable, walletsTable, usersTable, auditLogsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { PushNotify } from "../routes/push.js";

// ─── Daily limits (USD) ───────────────────────────────────────────────────────
export const DAILY_LIMITS: Record<string, number> = {
  withdraw: 1000,
  card_fund: 500,
  internal_send: 5000,
};

// ─── Velocity check ───────────────────────────────────────────────────────────
export async function checkVelocity(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now();
  const [last5Min, last1Hour] = await Promise.all([
    db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.userId, userId),
        gte(transactionsTable.createdAt, new Date(now - 5 * 60 * 1000))
      )
    ),
    db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.userId, userId),
        gte(transactionsTable.createdAt, new Date(now - 60 * 60 * 1000))
      )
    ),
  ]);

  if (last5Min.length >= 5) {
    PushNotify.adminAlert(
      `⚠️ VELOCITY ALERT: User ${userId} made ${last5Min.length} transactions in 5 minutes`
    ).catch(() => {});
    return { allowed: false, reason: "Too many transactions in a short period. Please wait a few minutes." };
  }

  if (last1Hour.length >= 20) {
    PushNotify.adminAlert(
      `⚠️ VELOCITY ALERT: User ${userId} made ${last1Hour.length} transactions in 1 hour`
    ).catch(() => {});
    return { allowed: false, reason: "Hourly transaction limit reached. Please try again later." };
  }

  return { allowed: true };
}

// ─── Balance integrity check ─────────────────────────────────────────────────
export async function checkBalance(userId: number, amount: number, reason: string): Promise<{ allowed: boolean; reason?: string }> {
  const wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).then(r => r[0]);
  if (!wallet) return { allowed: false, reason: "Wallet not found" };

  const available = parseFloat(wallet.availableBalance);

  if (available < amount) {
    console.error(`[Security] Balance check failed — user: ${userId}, available: ${available}, requested: ${amount}, reason: ${reason}`);
    PushNotify.adminAlert(
      `⚠️ Balance check failed for user ${userId}: tried to deduct $${amount} but only has $${available}`
    ).catch(() => {});
    return { allowed: false, reason: "Insufficient balance" };
  }

  if (available > 100000) {
    console.error(`[Security] Suspicious balance — user: ${userId}, balance: ${available}`);
    PushNotify.adminAlert(
      `🚨 SUSPICIOUS BALANCE: User ${userId} has $${available} — possible exploit!`
    ).catch(() => {});
    return { allowed: false, reason: "Account flagged for security review. Please contact support." };
  }

  return { allowed: true };
}

// ─── Daily limit check ────────────────────────────────────────────────────────
export async function checkDailyLimit(userId: number, type: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, type as any),
        gte(transactionsTable.createdAt, startOfDay)
      )
    );

  const used = parseFloat(String(rows[0]?.total ?? "0"));
  const limit = DAILY_LIMITS[type] ?? 1000;

  if (used + amount > limit) {
    return {
      allowed: false,
      reason: `Daily ${type} limit of $${limit} reached. Used: $${used.toFixed(2)}, Requested: $${amount.toFixed(2)}.`,
    };
  }

  return { allowed: true };
}

// ─── Withdrawal address check ─────────────────────────────────────────────────
export async function checkWithdrawalAddress(userId: number, address: string): Promise<{ allowed: boolean; reason?: string }> {
  const previous = await db.select().from(transactionsTable).where(
    and(
      eq(transactionsTable.userId, userId),
      eq(transactionsTable.address, address),
      eq(transactionsTable.type, "withdraw"),
      eq(transactionsTable.status, "completed")
    )
  ).limit(1);

  if (previous.length === 0) {
    PushNotify.adminAlert(
      `ℹ️ First withdrawal to new address — User: ${userId}, Address: ${address}`
    ).catch(() => {});
  }

  return { allowed: true };
}

// ─── Account status check middleware ─────────────────────────────────────────
const FINANCIAL_PATHS = ["/withdraw", "/send", "/internal-transfer", "/cards/fund", "/cards/withdraw", "/cards/create"];

export async function checkAccountStatus(req: any, res: any, next: any) {
  const userId = req.userId;
  if (!userId) return next();

  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then(r => r[0]);

    if (!user) return next();

    if (user.isBanned) {
      return res.status(403).json({ error: "Your account has been permanently suspended. Contact support." });
    }

    if (user.isFrozen) {
      const isFinancial = FINANCIAL_PATHS.some(p => req.path.includes(p));
      if (isFinancial) {
        return res.status(403).json({ error: "Your account is temporarily frozen. Contact support." });
      }
    }

    next();
  } catch {
    next();
  }
}

// ─── Audit logger ─────────────────────────────────────────────────────────────
export async function auditLog(userId: number, action: string, details: object, req: any): Promise<void> {
  db.insert(auditLogsTable).values({
    userId,
    action,
    details,
    ipAddress: req.ip ?? null,
    userAgent: req.headers?.["user-agent"] ?? null,
  }).catch(() => {});
}

// ─── Suspicious activity detector ────────────────────────────────────────────
export async function detectSuspiciousActivity(): Promise<void> {
  try {
    const largeBalances = await db.select().from(walletsTable).where(
      sql`available_balance::numeric > 10000`
    );
    for (const wallet of largeBalances) {
      console.warn(`[Security] Large balance — user: ${wallet.userId}, balance: ${wallet.availableBalance}`);
      PushNotify.adminAlert(
        `⚠️ Large balance: User ${wallet.userId} has $${wallet.availableBalance} USDT`
      ).catch(() => {});
    }

    const negativeBalances = await db.select().from(walletsTable).where(
      sql`frozen_balance::numeric < 0`
    );
    for (const wallet of negativeBalances) {
      console.error(`[Security] Negative frozen balance — user: ${wallet.userId}, frozen: ${wallet.frozenBalance}`);
      PushNotify.adminAlert(
        `🚨 NEGATIVE FROZEN BALANCE: User ${wallet.userId} has frozen: $${wallet.frozenBalance} — possible exploit!`
      ).catch(() => {});
    }

    const cardExploits = await db.execute(sql`
      SELECT user_id,
        SUM(CASE WHEN note = 'Withdrawn from Xendrx card' THEN amount::numeric ELSE 0 END) as withdrawn,
        SUM(CASE WHEN note = 'Funded Xendrx card' THEN amount::numeric ELSE 0 END) as funded
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY user_id
      HAVING SUM(CASE WHEN note = 'Withdrawn from Xendrx card' THEN amount::numeric ELSE 0 END) >
             SUM(CASE WHEN note = 'Funded Xendrx card' THEN amount::numeric ELSE 0 END)
    `);

    for (const row of cardExploits.rows as any[]) {
      PushNotify.adminAlert(
        `🚨 CARD EXPLOIT DETECTED: User ${row.user_id} withdrew $${parseFloat(row.withdrawn).toFixed(2)} but only funded $${parseFloat(row.funded).toFixed(2)}!`
      ).catch(() => {});
    }
    // Check if any user's platform balance is impossibly higher than real chain deposits
    const suspiciousBalances = await db.execute(sql`
      SELECT 
        w.user_id,
        u.email,
        w.available_balance::numeric + w.frozen_balance::numeric as platform_balance,
        COALESCE(real_deps.total, 0) as real_deposits
      FROM wallets w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN (
        SELECT user_id, SUM(amount::numeric) as total
        FROM transactions
        WHERE type IN ('deposit', 'p2p_buy', 'p2p_sell', 'internal_receive')
        AND status = 'completed'
        GROUP BY user_id
      ) real_deps ON real_deps.user_id = w.user_id
      WHERE (w.available_balance::numeric + w.frozen_balance::numeric) >
            COALESCE(real_deps.total, 0) + 1000
      AND (w.available_balance::numeric + w.frozen_balance::numeric) > 100
    `);
    for (const user of suspiciousBalances.rows as any[]) {
      console.error(`[Security] SUSPICIOUS: User ${user.user_id} (${user.email}) has platform balance $${user.platform_balance} but only deposited $${user.real_deposits} on chain!`);
      PushNotify.adminAlert(
        `🚨 SUSPICIOUS BALANCE: ${user.email} has $${parseFloat(user.platform_balance).toFixed(2)} platform balance but only $${parseFloat(user.real_deposits).toFixed(2)} real deposits!`
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[Security] detectSuspiciousActivity error:", err);
  }
}
