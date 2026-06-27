import { Router } from "express";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { emitToUser } from "../lib/sse";
import { db } from "@workspace/db";
import {
  usersTable, adsTable, ordersTable, kycSubmissionsTable, appealsTable,
  transactionsTable, walletsTable, messagesTable, notificationsTable,
  adminLogsTable, systemSettingsTable, notificationHistoryTable, fraudFlagsTable,
  depositVerificationsTable, cardWaitlistTable, feeSettingsTable, platformWalletTable,
  feeTransactionsTable, addressVerificationsTable, adminEmailSendsTable, cardsTable,
} from "@workspace/db";
import { eq, desc, and, or, ilike, sql, ne, count, inArray } from "drizzle-orm";
import { getFeePercents, calculateFees } from "../helpers/fees.js";
import { PushNotify, sendPushBroadcast } from "./push.js";
import { TelegramNotify } from "../telegram/notify.js";
import { telegramUsersTable } from "@workspace/db";
import { sendTelegramMessage, restartBotWithToken, getBotStatus } from "../telegram/bot.js";
import { sendUsdtBsc, getBscUsdtBalance } from "../lib/bsc.js";
import { sweepAllStuckFunds } from "../lib/deposit-monitor.js";

const router = Router();

// ─── Token helpers ──────────────────────────────────────────────────────────

function sign(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string, secret: string): { email: string; iat: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString());
    if (Date.now() - parsed.iat > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

function getSecret(): string {
  return process.env.ADMIN_JWT_SECRET ?? randomBytes(32).toString("hex");
}

// ─── Auth middleware ─────────────────────────────────────────────────────────

function adminAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice(7);
  const payload = verify(token, getSecret());
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  req.adminEmail = payload.email;
  next();
}

// ─── Audit logger ────────────────────────────────────────────────────────────

async function log(adminEmail: string, action: string, targetType?: string, targetId?: number, note?: string) {
  await db.insert(adminLogsTable).values({ adminEmail, action, targetType, targetId, note }).catch(() => {});
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordEnv = process.env.ADMIN_PASSWORD;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    // Check DB-stored password override first (set via change-password endpoint)
    const pwRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "adminPassword")).catch(() => [] as any[]);
    const adminPassword = pwRows[0]?.value ?? adminPasswordEnv;
    if (email !== adminEmail || password !== adminPassword)
      return res.status(401).json({ error: "Invalid credentials" });
    const token = sign({ email, iat: Date.now() }, getSecret());
    res.json({ token, admin: { email } });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/change-password", adminAuth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both fields required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    // Verify current password
    const pwRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "adminPassword")).catch(() => [] as any[]);
    const currentStored = pwRows[0]?.value ?? process.env.ADMIN_PASSWORD;
    if (currentPassword !== currentStored) return res.status(401).json({ error: "Current password is incorrect" });
    // Store new password
    await db.insert(systemSettingsTable).values({ key: "adminPassword", value: newPassword, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: newPassword, updatedAt: new Date() } });
    await log(req.adminEmail, "change_password", "admin", undefined, "Admin password changed");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin change password failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", adminAuth, (req: any, res) => {
  res.json({ email: req.adminEmail });
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

router.get("/stats/overview", adminAuth, async (req, res) => {
  try {
    const [totalUsers] = await db.select({ c: count() }).from(usersTable);
    const [pendingKyc] = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.kycStatus, "pending"));
    const [openOrders] = await db.select({ c: count() }).from(ordersTable).where(or(eq(ordersTable.status, "unpaid"), eq(ordersTable.status, "paid"))!);
    const [openDisputes] = await db.select({ c: count() }).from(appealsTable).where(eq(appealsTable.status, "pending"));
    const [pendingWithdrawals] = await db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, "pending")));
    const [totalVolume] = await db.select({ s: sql<string>`sum(${transactionsTable.amount}::numeric)` }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));
    const [completedOrders] = await db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.status, "completed"));

    const kycRows = await db.select({ status: usersTable.kycStatus, c: count() }).from(usersTable).groupBy(usersTable.kycStatus);
    const kycStats = Object.fromEntries(kycRows.map(r => [r.status, Number(r.c)]));

    res.json({
      totalUsers: Number(totalUsers.c),
      pendingKyc: Number(pendingKyc.c),
      openOrders: Number(openOrders.c),
      openDisputes: Number(openDisputes.c),
      pendingWithdrawals: Number(pendingWithdrawals.c),
      completedOrders: Number(completedOrders.c),
      totalVolume: totalVolume.s ?? "0",
      kycStats,
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/activity", adminAuth, async (req, res) => {
  try {
    const logs = await db.select().from(adminLogsTable).orderBy(desc(adminLogsTable.createdAt)).limit(20);
    const recentUsers = await db.select({ id: usersTable.id, username: usersTable.username, createdAt: usersTable.createdAt })
      .from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);
    const recentOrders = await db.select({ id: ordersTable.id, status: ordersTable.status, amountUsdt: ordersTable.amountUsdt, createdAt: ordersTable.createdAt })
      .from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5);
    res.json({ logs, recentUsers, recentOrders });
  } catch (err) {
    req.log.error({ err }, "Admin activity failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── USERS ───────────────────────────────────────────────────────────────────

router.get("/users", adminAuth, async (req, res) => {
  try {
    const { search, kycStatus, page = "1" } = req.query as Record<string, string>;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;
    let conditions: any[] = [];
    if (search) {
      conditions.push(or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
    }
    if (kycStatus && kycStatus !== "all") {
      conditions.push(eq(usersTable.kycStatus, kycStatus as any));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const users = await db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const [{ c: total }] = await db.select({ c: count() }).from(usersTable).where(where);
    res.json({ users, total: Number(total), page: parseInt(page), limit });
  } catch (err) {
    req.log.error({ err }, "Admin users list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).then(r => r[0]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, id)).then(r => r[0]);
    const [orderCount] = await db.select({ c: count() }).from(ordersTable).where(or(eq(ordersTable.buyerId, id), eq(ordersTable.sellerId, id))!);
    const kyc = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, id)).then(r => r[0]);
    const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, id)).orderBy(desc(transactionsTable.createdAt)).limit(10);
    const orders = await db.select().from(ordersTable).where(or(eq(ordersTable.buyerId, id), eq(ordersTable.sellerId, id))!).orderBy(desc(ordersTable.createdAt)).limit(10);
    const ads = await db.select().from(adsTable).where(eq(adsTable.userId, id)).orderBy(desc(adsTable.createdAt)).limit(10);
    res.json({ user, wallet: wallet ?? null, orderCount: Number(orderCount.c), kyc: kyc ?? null, transactions: txs, orders, ads });
  } catch (err) {
    req.log.error({ err }, "Admin user detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/suspend", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason, duration } = req.body ?? {};
    const now = new Date();
    const durationMap: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };
    let suspendedUntil: Date | null = null;
    if (duration && duration !== "permanent" && durationMap[duration]) {
      suspendedUntil = new Date(now.getTime() + durationMap[duration] * 24 * 60 * 60 * 1000);
    }
    await db.update(usersTable).set({
      isSuspended: true,
      suspensionReason: reason ?? null,
      suspendedAt: now,
      suspendedUntil: suspendedUntil ?? undefined,
    }).where(eq(usersTable.id, id));
    // Auto-cancel all active orders for this user
    const activeOrders = await db.select().from(ordersTable).where(
      and(
        or(eq(ordersTable.buyerId, id), eq(ordersTable.sellerId, id))!,
        or(eq(ordersTable.status, "unpaid"), eq(ordersTable.status, "paid"))!
      )
    );
    for (const order of activeOrders) {
      await db.update(ordersTable).set({ status: "cancelled", cancelReason: "Account suspended" }).where(eq(ordersTable.id, order.id));
    }
    await log(req.adminEmail, "suspend_user", "user", id, `${reason} (${duration ?? "permanent"})`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin suspend user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/unsuspend", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(usersTable).set({ isSuspended: false, suspensionReason: null, suspendedUntil: null as any }).where(eq(usersTable.id, id));
    await log(req.adminEmail, "unsuspend_user", "user", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin unsuspend user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/flag", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { flagType = "manual", description } = req.body ?? {};
    await db.insert(fraudFlagsTable).values({
      userId: id,
      flagType,
      description: description ?? null,
      flaggedBy: "admin",
    });
    await db.update(usersTable).set({ flagCount: sql`${usersTable.flagCount} + 1` }).where(eq(usersTable.id, id));
    await log(req.adminEmail, "flag_user", "user", id, `${flagType}: ${description}`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin flag user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/merchant", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isMerchant } = req.body ?? {};
    await db.update(usersTable).set({ isMerchant: !!isMerchant }).where(eq(usersTable.id, id));
    await log(req.adminEmail, isMerchant ? "grant_merchant" : "revoke_merchant", "user", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin toggle merchant failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/verify", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(usersTable).set({ kycStatus: "verified" }).where(eq(usersTable.id, id));
    await db.update(kycSubmissionsTable).set({ status: "verified" as any, reviewedAt: new Date() }).where(eq(kycSubmissionsTable.userId, id));
    await log(req.adminEmail, "manual_verify_user", "user", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin verify user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await log(req.adminEmail, "delete_user", "user", id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete user failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── KYC ─────────────────────────────────────────────────────────────────────

async function formatKyc(sub: any) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId)).then(r => r[0]);
  return {
    id: sub.id, userId: sub.userId,
    username: user?.username ?? "Unknown", email: user?.email ?? "",
    fullName: sub.fullName, dateOfBirth: sub.dateOfBirth, nationality: sub.nationality,
    idType: sub.idType, frontImageUrl: sub.frontImageUrl, backImageUrl: sub.backImageUrl ?? null,
    selfieUrl: sub.selfieUrl, livenessResult: (() => { try { return JSON.parse(sub.livenessResult); } catch { return {}; } })(),
    status: sub.status, rejectionReason: sub.rejectionReason ?? null, adminMessage: sub.adminMessage ?? null,
    submittedAt: sub.submittedAt, reviewedAt: sub.reviewedAt ?? null,
    isOld: sub.submittedAt && (Date.now() - new Date(sub.submittedAt).getTime() > 48 * 60 * 60 * 1000),
  };
}

router.get("/kyc", adminAuth, async (req, res) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    let subs = await db.select().from(kycSubmissionsTable).orderBy(desc(kycSubmissionsTable.submittedAt));
    if (status) subs = subs.filter(s => s.status === status);
    const formatted = await Promise.all(subs.map(formatKyc));
    const filtered = search ? formatted.filter(f =>
      f.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      f.username?.toLowerCase().includes(search.toLowerCase()) ||
      String(f.userId) === search
    ) : formatted;
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Admin kyc list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/kyc/stats", adminAuth, async (req, res) => {
  try {
    const all = await db.select({ status: kycSubmissionsTable.status, c: count() })
      .from(kycSubmissionsTable).groupBy(kycSubmissionsTable.status);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const approvedToday = await db.select({ c: count() }).from(kycSubmissionsTable)
      .where(and(eq(kycSubmissionsTable.status, "verified" as any), sql`${kycSubmissionsTable.reviewedAt} >= ${today}`));
    const rejectedToday = await db.select({ c: count() }).from(kycSubmissionsTable)
      .where(and(eq(kycSubmissionsTable.status, "rejected" as any), sql`${kycSubmissionsTable.reviewedAt} >= ${today}`));
    res.json({
      byStatus: Object.fromEntries(all.map(r => [r.status, Number(r.c)])),
      approvedToday: Number(approvedToday[0].c),
      rejectedToday: Number(rejectedToday[0].c),
    });
  } catch (err) {
    req.log.error({ err }, "Admin kyc stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/kyc/:userId", adminAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const sub = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, userId)).then(r => r[0]);
    if (!sub) return res.status(404).json({ error: "KYC not found" });
    res.json(await formatKyc(sub));
  } catch (err) {
    req.log.error({ err }, "Admin kyc detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/kyc/:userId/review", adminAuth, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { decision, rejectionReason, adminMessage } = req.body ?? {};
    const newStatus = decision === "verified" ? "verified" : decision === "rejected" ? "rejected" : "more_info_required";
    await db.update(kycSubmissionsTable).set({ status: newStatus as any, rejectionReason: rejectionReason ?? null, adminMessage: adminMessage ?? null, reviewedAt: new Date() }).where(eq(kycSubmissionsTable.userId, userId));
    await db.update(usersTable).set({ kycStatus: newStatus as any }).where(eq(usersTable.id, userId));
    await log(req.adminEmail, `kyc_${newStatus}`, "kyc", userId, rejectionReason);
    emitToUser(userId, "kyc_update", {
      status: newStatus,
      rejectionReason: rejectionReason ?? null,
      adminMessage: adminMessage ?? null,
    });
    if (newStatus === "verified") {
      PushNotify.kycApproved(userId).catch(console.error);
      TelegramNotify.kycApproved(userId).catch(console.error);
    } else if (newStatus === "rejected") {
      PushNotify.kycRejected(userId, rejectionReason ?? "Documents not accepted").catch(console.error);
      TelegramNotify.kycRejected(userId, rejectionReason ?? "Documents not accepted").catch(console.error);
    }
    const sub = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, userId)).then(r => r[0]);
    res.json(await formatKyc(sub!));
  } catch (err) {
    req.log.error({ err }, "Admin kyc review failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ADS ─────────────────────────────────────────────────────────────────────

router.get("/ads", adminAuth, async (req, res) => {
  try {
    const { search, status, type, page = "1" } = req.query as Record<string, string>;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;
    let conditions: any[] = [];
    if (status && status !== "all") conditions.push(eq(adsTable.status, status as any));
    if (type && type !== "all") conditions.push(eq(adsTable.type, type as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const ads = await db.select().from(adsTable).where(where).orderBy(desc(adsTable.createdAt)).limit(limit).offset(offset);
    const [{ c: total }] = await db.select({ c: count() }).from(adsTable).where(where);
    const enriched = await Promise.all(ads.map(async ad => {
      const user = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, ad.userId)).then(r => r[0]);
      const paymentMethods = (() => { try { return JSON.parse(ad.paymentMethods); } catch { return []; } })();
      return { ...ad, username: user?.username ?? "Unknown", paymentMethods };
    }));
    const filtered = search ? enriched.filter(a => a.username.toLowerCase().includes(search.toLowerCase())) : enriched;
    res.json({ ads: filtered, total: Number(total), page: parseInt(page), limit });
  } catch (err) {
    req.log.error({ err }, "Admin ads list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ads/:id/suspend", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(adsTable).set({ status: "offline" }).where(eq(adsTable.id, id));
    await log(req.adminEmail, "suspend_ad", "ad", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin suspend ad failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ads/:id/reactivate", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(adsTable).set({ status: "online", pauseReason: null } as any).where(eq(adsTable.id, id));
    await log(req.adminEmail, "reactivate_ad", "ad", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin reactivate ad failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ads/:id", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await log(req.adminEmail, "delete_ad", "ad", id);
    await db.delete(adsTable).where(eq(adsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete ad failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

router.get("/orders", adminAuth, async (req, res) => {
  try {
    const { status, search, page = "1" } = req.query as Record<string, string>;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;
    let conditions: any[] = [];
    if (status && status !== "all") conditions.push(eq(ordersTable.status, status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orders = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);
    const [{ c: total }] = await db.select({ c: count() }).from(ordersTable).where(where);
    const enriched = await Promise.all(orders.map(async o => {
      const buyer = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, o.buyerId)).then(r => r[0]);
      const seller = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, o.sellerId)).then(r => r[0]);
      return { ...o, buyerUsername: buyer?.username ?? "Unknown", sellerUsername: seller?.username ?? "Unknown" };
    }));
    const filtered = search ? enriched.filter(o => o.buyerUsername.toLowerCase().includes(search.toLowerCase()) || o.sellerUsername.toLowerCase().includes(search.toLowerCase()) || String(o.id).includes(search)) : enriched;
    res.json({ orders: filtered, total: Number(total), page: parseInt(page), limit });
  } catch (err) {
    req.log.error({ err }, "Admin orders list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
    const seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.orderId, id)).orderBy(messagesTable.createdAt);
    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.orderId, id)).then(r => r[0]);
    res.json({ order, buyer: buyer ?? null, seller: seller ?? null, messages, appeal: appeal ?? null });
  } catch (err) {
    req.log.error({ err }, "Admin order detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:id/force-complete", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body ?? {};

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { makerFeePercent, takerFeePercent } = await getFeePercents();
    const grossUsdt = parseFloat(order.amountUsdt);
    const { makerFee, takerFee, totalFee, netUsdt } = calculateFees(grossUsdt, makerFeePercent, takerFeePercent);
    const now = new Date();

    await db.transaction(async (tx) => {
      // Release seller frozen USDT
      const sellerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.sellerId)).then(r => r[0]);
      if (sellerWallet) {
        await tx.update(walletsTable)
          .set({ frozenBalance: Math.max(0, parseFloat(sellerWallet.frozenBalance) - grossUsdt).toFixed(8) })
          .where(eq(walletsTable.userId, order.sellerId));
      }

      // Credit buyer with net amount (after fees)
      const buyerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.buyerId)).then(r => r[0]);
      if (buyerWallet) {
        await tx.update(walletsTable)
          .set({ availableBalance: (parseFloat(buyerWallet.availableBalance) + netUsdt).toFixed(8) })
          .where(eq(walletsTable.userId, order.buyerId));
      } else {
        await tx.insert(walletsTable).values({ userId: order.buyerId, availableBalance: netUsdt.toFixed(8), frozenBalance: "0.00" });
      }

      // Add fees to platform wallet
      const pw = await tx.select().from(platformWalletTable).where(eq(platformWalletTable.asset, "USDT")).then(r => r[0]);
      if (pw) {
        await tx.update(platformWalletTable)
          .set({ totalCollected: (parseFloat(String(pw.totalCollected)) + totalFee).toFixed(8), updatedAt: now })
          .where(eq(platformWalletTable.asset, "USDT"));
      } else {
        await tx.insert(platformWalletTable).values({ asset: "USDT", totalCollected: totalFee.toFixed(8) });
      }

      // Update order with fee details
      await tx.update(ordersTable).set({
        status: "completed",
        makerFeePercent: String(makerFeePercent),
        takerFeePercent: String(takerFeePercent),
        makerFeeAmount: makerFee.toFixed(8),
        takerFeeAmount: takerFee.toFixed(8),
        makerNetAmount: (grossUsdt - makerFee).toFixed(8),
        takerNetAmount: netUsdt.toFixed(8),
        releasedAt: now,
        completedAt: now,
      }).where(eq(ordersTable.id, id));

      // Log fee transactions
      const ad = await tx.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
      const makerId = ad?.userId ?? order.sellerId;
      const takerId = makerId === order.buyerId ? order.sellerId : order.buyerId;
      await tx.insert(feeTransactionsTable).values([
        { orderId: id, userId: makerId, feeType: "maker", feePercent: String(makerFeePercent), grossAmount: grossUsdt.toFixed(8), feeAmount: makerFee.toFixed(8), netAmount: (grossUsdt - makerFee).toFixed(8) },
        { orderId: id, userId: takerId, feeType: "taker", feePercent: String(takerFeePercent), grossAmount: grossUsdt.toFixed(8), feeAmount: takerFee.toFixed(8), netAmount: netUsdt.toFixed(8) },
      ]);

      // Transaction records
      await tx.insert(transactionsTable).values([
        { userId: order.buyerId, type: "p2p_buy", amount: netUsdt.toFixed(8), status: "completed", note: `Admin force-completed. Bought ${grossUsdt} USDT. Fee: ${totalFee.toFixed(8)} USDT. Received: ${netUsdt.toFixed(8)} USDT` },
        { userId: order.sellerId, type: "p2p_sell", amount: grossUsdt.toFixed(8), status: "completed", note: `Admin force-completed. Sold ${grossUsdt} USDT` },
      ]);
    });

    await log(req.adminEmail, "force_complete_order", "order", id, note);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin force complete failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:id/force-cancel", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body ?? {};
    await db.update(ordersTable).set({ status: "cancelled", cancelReason: note ?? "Admin cancelled" }).where(eq(ordersTable.id, id));
    await log(req.adminEmail, "force_cancel_order", "order", id, note);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin force cancel failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:id/add-note", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body ?? {};
    if (!note?.trim()) return res.status(400).json({ error: "Note is required" });
    await db.update(ordersTable).set({ adminNote: note.trim() }).where(eq(ordersTable.id, id));
    await log(req.adminEmail, "add_order_note", "order", id, note);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin add order note failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DISPUTES ────────────────────────────────────────────────────────────────

router.get("/disputes", adminAuth, async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    let appeals = await db.select().from(appealsTable).orderBy(appealsTable.createdAt);
    if (status && status !== "all") appeals = appeals.filter(a => a.status === status);
    const enriched = await Promise.all(appeals.map(async a => {
      const raiser = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, a.raisedBy)).then(r => r[0]);
      const evidenceUrls = (() => { try { return JSON.parse(a.evidenceUrls); } catch { return []; } })();
      return { ...a, raisedByUsername: raiser?.username ?? "Unknown", evidenceCount: evidenceUrls.length, evidenceUrls };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Admin disputes list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/disputes/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.id, id)).then(r => r[0]);
    if (!appeal) return res.status(404).json({ error: "Dispute not found" });
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, appeal.orderId)).then(r => r[0]);
    const raiser = await db.select().from(usersTable).where(eq(usersTable.id, appeal.raisedBy)).then(r => r[0]);
    const messages = order ? await db.select().from(messagesTable).where(eq(messagesTable.orderId, order.id)).orderBy(messagesTable.createdAt) : [];
    const evidenceUrls = (() => { try { return JSON.parse(appeal.evidenceUrls); } catch { return []; } })();
    let buyer = null; let seller = null;
    if (order) {
      buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
      seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);
    }
    res.json({ appeal: { ...appeal, evidenceUrls }, order: order ?? null, raiser: raiser ?? null, buyer: buyer ?? null, seller: seller ?? null, messages });
  } catch (err) {
    req.log.error({ err }, "Admin dispute detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/disputes/:id/resolve", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision, adminNote } = req.body ?? {};

    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.id, id)).then(r => r[0]);
    if (!appeal) return res.status(404).json({ error: "Dispute not found" });

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, appeal.orderId)).then(r => r[0]);

    if (order) {
      const grossUsdt = parseFloat(order.amountUsdt);
      const now = new Date();

      if (decision === "buyer_wins") {
        // Apply fees and settle — buyer gets net USDT, platform collects fee
        const { makerFeePercent, takerFeePercent } = await getFeePercents();
        const { makerFee, takerFee, totalFee, netUsdt } = calculateFees(grossUsdt, makerFeePercent, takerFeePercent);

        await db.transaction(async (tx) => {
          // Release seller frozen
          const sellerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.sellerId)).then(r => r[0]);
          if (sellerWallet) {
            await tx.update(walletsTable)
              .set({ frozenBalance: Math.max(0, parseFloat(sellerWallet.frozenBalance) - grossUsdt).toFixed(8) })
              .where(eq(walletsTable.userId, order.sellerId));
          }

          // Credit buyer with net amount
          const buyerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.buyerId)).then(r => r[0]);
          if (buyerWallet) {
            await tx.update(walletsTable)
              .set({ availableBalance: (parseFloat(buyerWallet.availableBalance) + netUsdt).toFixed(8) })
              .where(eq(walletsTable.userId, order.buyerId));
          } else {
            await tx.insert(walletsTable).values({ userId: order.buyerId, availableBalance: netUsdt.toFixed(8), frozenBalance: "0.00" });
          }

          // Add fees to platform wallet
          const pw = await tx.select().from(platformWalletTable).where(eq(platformWalletTable.asset, "USDT")).then(r => r[0]);
          if (pw) {
            await tx.update(platformWalletTable)
              .set({ totalCollected: (parseFloat(String(pw.totalCollected)) + totalFee).toFixed(8), updatedAt: now })
              .where(eq(platformWalletTable.asset, "USDT"));
          } else {
            await tx.insert(platformWalletTable).values({ asset: "USDT", totalCollected: totalFee.toFixed(8) });
          }

          // Update appeal and order with fee details
          await tx.update(appealsTable)
            .set({ status: "resolved", adminDecision: decision, resolvedAt: now })
            .where(eq(appealsTable.id, id));

          await tx.update(ordersTable).set({
            status: "completed",
            makerFeePercent: String(makerFeePercent),
            takerFeePercent: String(takerFeePercent),
            makerFeeAmount: makerFee.toFixed(8),
            takerFeeAmount: takerFee.toFixed(8),
            makerNetAmount: (grossUsdt - makerFee).toFixed(8),
            takerNetAmount: netUsdt.toFixed(8),
            releasedAt: now,
            completedAt: now,
            adminNote: adminNote ?? null,
          }).where(eq(ordersTable.id, order.id));

          // Log fee transactions
          const ad = await tx.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
          const makerId = ad?.userId ?? order.sellerId;
          const takerId = makerId === order.buyerId ? order.sellerId : order.buyerId;
          await tx.insert(feeTransactionsTable).values([
            { orderId: order.id, userId: makerId, feeType: "maker", feePercent: String(makerFeePercent), grossAmount: grossUsdt.toFixed(8), feeAmount: makerFee.toFixed(8), netAmount: (grossUsdt - makerFee).toFixed(8) },
            { orderId: order.id, userId: takerId, feeType: "taker", feePercent: String(takerFeePercent), grossAmount: grossUsdt.toFixed(8), feeAmount: takerFee.toFixed(8), netAmount: netUsdt.toFixed(8) },
          ]);

          // Transaction records
          await tx.insert(transactionsTable).values([
            { userId: order.buyerId, type: "p2p_buy", amount: netUsdt.toFixed(8), status: "completed", note: `Dispute resolved (buyer wins). Received ${netUsdt.toFixed(8)} USDT after fee.` },
            { userId: order.sellerId, type: "p2p_sell", amount: grossUsdt.toFixed(8), status: "completed", note: `Dispute resolved (buyer wins). Sold ${grossUsdt} USDT.` },
          ]);
        });
      } else {
        // seller_wins — return USDT from frozen back to seller available, no fees
        await db.transaction(async (tx) => {
          const sellerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.sellerId)).then(r => r[0]);
          if (sellerWallet) {
            await tx.update(walletsTable).set({
              availableBalance: (parseFloat(sellerWallet.availableBalance) + grossUsdt).toFixed(8),
              frozenBalance: Math.max(0, parseFloat(sellerWallet.frozenBalance) - grossUsdt).toFixed(8),
            }).where(eq(walletsTable.userId, order.sellerId));
          }

          await tx.update(appealsTable)
            .set({ status: "resolved", adminDecision: decision, resolvedAt: now })
            .where(eq(appealsTable.id, id));

          await tx.update(ordersTable)
            .set({ status: "cancelled", completedAt: now, adminNote: adminNote ?? null })
            .where(eq(ordersTable.id, order.id));

          // Transaction records so both users see the outcome in their history
          await tx.insert(transactionsTable).values([
            { userId: order.sellerId, type: "p2p_sell", amount: grossUsdt.toFixed(8), status: "completed", note: `Dispute resolved (seller wins). ${grossUsdt.toFixed(8)} USDT returned to your balance.` },
            { userId: order.buyerId, type: "p2p_buy", amount: grossUsdt.toFixed(8), status: "failed", note: `Dispute resolved (seller wins). Order #${order.id} closed against you.` },
          ]);
        });
      }
    } else {
      // No order found — just update appeal status
      const newStatus = decision === "buyer_wins" ? "completed" : "cancelled";
      await db.update(appealsTable)
        .set({ status: "resolved", adminDecision: decision, resolvedAt: new Date() })
        .where(eq(appealsTable.id, id));
      await db.update(ordersTable)
        .set({ status: newStatus as any, completedAt: new Date() })
        .where(eq(ordersTable.id, appeal.orderId));
    }

    await log(req.adminEmail, "resolve_dispute", "appeal", id, `${decision}: ${adminNote}`);
    if (order) {
      const buyerWins = decision === "buyer_wins";
      PushNotify.appealResolved(order.buyerId, order.id, buyerWins).catch(console.error);
      PushNotify.appealResolved(order.sellerId, order.id, !buyerWins).catch(console.error);
      TelegramNotify.appealResolved(order.buyerId, order.id, buyerWins).catch(console.error);
      TelegramNotify.appealResolved(order.sellerId, order.id, !buyerWins).catch(console.error);
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin resolve dispute failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recalculate frozen balances for all users based on actual active orders
router.post("/wallet/recalculate-frozen", adminAuth, async (req: any, res) => {
  try {
    const allWallets = await db.select().from(walletsTable);
    const results: Array<{ userId: number; username: string; oldFrozen: string; newFrozen: string; released: string }> = [];

    for (const wallet of allWallets) {
      // Sum USDT from orders where this user is the seller AND order is still active (frozen)
      const activeSellerOrders = await db.select().from(ordersTable)
        .where(and(
          eq(ordersTable.sellerId, wallet.userId),
          or(
            eq(ordersTable.status, "unpaid" as any),
            eq(ordersTable.status, "paid" as any),
            eq(ordersTable.status, "appeal" as any)
          )
        ));

      const correctFrozen = activeSellerOrders.reduce((sum, o) => sum + parseFloat(o.amountUsdt), 0);
      const oldFrozen = parseFloat(wallet.frozenBalance);
      const diff = oldFrozen - correctFrozen;

      if (Math.abs(diff) > 0.0001) {
        const oldAvailable = parseFloat(wallet.availableBalance);
        await db.update(walletsTable).set({
          frozenBalance: correctFrozen.toFixed(4),
          availableBalance: (oldAvailable + diff).toFixed(4),
        }).where(eq(walletsTable.userId, wallet.userId));

        const user = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, wallet.userId)).then(r => r[0]);
        results.push({
          userId: wallet.userId,
          username: user?.username ?? "unknown",
          oldFrozen: oldFrozen.toFixed(4),
          newFrozen: correctFrozen.toFixed(4),
          released: diff.toFixed(4),
        });
      }
    }

    await log(req.adminEmail, "recalculate_frozen", "system", 0, `Fixed ${results.length} wallets`);
    res.json({ fixed: results.length, results });
  } catch (err) {
    req.log.error({ err }, "Recalculate frozen failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WALLET & TRANSACTIONS ───────────────────────────────────────────────────

router.get("/wallet/overview", adminAuth, async (req, res) => {
  try {
    const wallets = await db.select().from(walletsTable);
    const totalAvailable = wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance || "0"), 0);
    const totalFrozen = wallets.reduce((sum, w) => sum + parseFloat(w.frozenBalance || "0"), 0);
    const [pending] = await db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, "pending")));

    // Fetch hot wallet USDT balance (BSC)
    let hotWalletBalance: string | null = null;
    const privateKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
    if (privateKey) {
      try {
        const { ethers } = await import("ethers");
        const hotWallet = new ethers.Wallet(privateKey);
        hotWalletBalance = await getBscUsdtBalance(hotWallet.address);
      } catch (balErr) {
        req.log.warn({ balErr }, "Could not fetch BSC hot wallet balance for overview");
      }
    }

    res.json({
      totalAvailable: totalAvailable.toFixed(2),
      totalFrozen: totalFrozen.toFixed(2),
      totalUsdt: (totalAvailable + totalFrozen).toFixed(2),
      pendingWithdrawals: Number(pending.c),
      hotWalletBalance,
    });
  } catch (err) {
    req.log.error({ err }, "Admin wallet overview failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/wallet/transactions/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).then(r => r[0]);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    const user = await db.select({ username: usersTable.username, email: usersTable.email, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, tx.userId)).then(r => r[0]);
    res.json({ ...tx, username: user?.username ?? "Unknown", email: user?.email ?? "", phone: user?.phone ?? "" });
  } catch (err) {
    req.log.error({ err }, "Admin transaction detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/wallet/transactions", adminAuth, async (req, res) => {
  try {
    const { type, status, page = "1" } = req.query as Record<string, string>;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;
    let conditions: any[] = [];
    if (type && type !== "all") conditions.push(eq(transactionsTable.type, type as any));
    if (status && status !== "all") conditions.push(eq(transactionsTable.status, status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const txs = await db.select().from(transactionsTable).where(where).orderBy(desc(transactionsTable.createdAt)).limit(limit).offset(offset);
    const [{ c: total }] = await db.select({ c: count() }).from(transactionsTable).where(where);
    const enriched = await Promise.all(txs.map(async tx => {
      const user = await db.select({ username: usersTable.username, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, tx.userId)).then(r => r[0]);
      return { ...tx, username: user?.username ?? "Unknown", email: user?.email ?? "" };
    }));
    res.json({ transactions: enriched, total: Number(total), page: parseInt(page), limit });
  } catch (err) {
    req.log.error({ err }, "Admin transactions list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/wallet/transactions/:id/approve", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const approvedTx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).then(r => r[0]);

    if (!approvedTx) return res.status(404).json({ error: "Withdrawal not found" });
    if (approvedTx.status === "completed") return res.status(400).json({ error: "Withdrawal already completed" });
    if (approvedTx.type !== "withdraw") return res.status(400).json({ error: "Transaction is not a withdrawal" });

    const address = approvedTx.address;
    if (!address) return res.status(400).json({ error: "Withdrawal has no destination address" });

    const privateKey = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
    if (!privateKey) return res.status(503).json({ error: "BSC_HOT_WALLET_PRIVATE_KEY not configured" });

    const totalAmt = parseFloat(approvedTx.amount);
    const fee = parseFloat(approvedTx.fee ?? "0");
    const netAmount = totalAmt - fee;

    console.log("[Withdraw] BSC transfer to:", address, "amount:", netAmount, "USDT");

    try {
      const txid = await sendUsdtBsc(privateKey, address, netAmount);
      await db.update(transactionsTable)
        .set({ status: "completed", txid })
        .where(eq(transactionsTable.id, id));
      await log(req.adminEmail, "approve_withdrawal", "transaction", id, `Broadcast OK — txid: ${txid}`);
      console.log("[Withdraw] Broadcast successful, txid:", txid);
      PushNotify.withdrawalApproved(approvedTx.userId, approvedTx.amount).catch(console.error);
      TelegramNotify.withdrawalApproved(approvedTx.userId, approvedTx.amount).catch(console.error);
      return res.json({ success: true, txid });
    } catch (broadcastErr: any) {
      req.log.error({ broadcastErr, id, address }, "Admin approve — broadcast failed, keeping pending");
      console.log("[Withdraw] Broadcast failed for txId:", id, broadcastErr?.message);
      await db.update(transactionsTable)
        .set({ status: "pending" })
        .where(eq(transactionsTable.id, id));
      await log(req.adminEmail, "approve_withdrawal_failed", "transaction", id, broadcastErr?.message ?? "Broadcast error");
      return res.status(502).json({ error: "Blockchain broadcast failed — withdrawal kept as pending", detail: broadcastErr?.message });
    }
  } catch (err) {
    req.log.error({ err }, "Admin approve withdrawal failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/wallet/transactions/:id/reject", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body ?? {};
    const rejectReason = reason?.trim() || "Rejected by admin";
    const tx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).then(r => r[0]);
    if (tx) {
      await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, id));
      const wallet = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, tx.userId), eq(walletsTable.asset, "USDT"))).then(r => r[0]);
      if (wallet) {
        const newBalance = (parseFloat(wallet.availableBalance) + parseFloat(tx.amount)).toFixed(6);
        await db.update(walletsTable).set({ availableBalance: newBalance }).where(eq(walletsTable.id, wallet.id));
      }
      PushNotify.withdrawalRejected(tx.userId, tx.amount, rejectReason).catch(console.error);
      TelegramNotify.withdrawalRejected(tx.userId, tx.amount, rejectReason).catch(console.error);
    }
    await log(req.adminEmail, "reject_withdrawal", "transaction", id, rejectReason);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin reject withdrawal failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────

router.get("/messages/conversations", adminAuth, async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(50);
    const enriched = await Promise.all(orders.map(async o => {
      const buyer = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, o.buyerId)).then(r => r[0]);
      const seller = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, o.sellerId)).then(r => r[0]);
      const [{ c: msgCount }] = await db.select({ c: count() }).from(messagesTable).where(eq(messagesTable.orderId, o.id));
      return { orderId: o.id, status: o.status, buyerUsername: buyer?.username ?? "Unknown", sellerUsername: seller?.username ?? "Unknown", messageCount: Number(msgCount), createdAt: o.createdAt };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Admin conversations list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/messages/orders/:orderId", adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.orderId, orderId)).orderBy(messagesTable.createdAt);
    const enriched = await Promise.all(msgs.map(async m => {
      const sender = m.senderId
        ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, m.senderId)).then(r => r[0])
        : null;
      return { ...m, senderUsername: sender?.username ?? "Admin" };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Admin messages failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId/messages", adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.orderId, orderId)).orderBy(messagesTable.createdAt);
    const enriched = await Promise.all(msgs.map(async m => {
      const sender = m.senderId
        ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, m.senderId)).then(r => r[0])
        : null;
      return { ...m, senderUsername: sender?.username ?? "Admin" };
    }));
    res.json({ messages: enriched });
  } catch (err) {
    req.log.error({ err }, "Admin order messages failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/disputes/:id/messages", adminAuth, async (req, res) => {
  try {
    const disputeId = parseInt(req.params.id);
    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.id, disputeId)).then(r => r[0]);
    if (!appeal) return res.status(404).json({ error: "Dispute not found" });

    const adminMessages = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.orderId, appeal.orderId), eq(messagesTable.type, "admin")))
      .orderBy(messagesTable.createdAt);

    return res.json({ messages: adminMessages });
  } catch (err) {
    req.log.error({ err }, "Admin dispute messages fetch failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/disputes/:id/message", adminAuth, async (req, res) => {
  try {
    const disputeId = parseInt(req.params.id);
    const { receiverId, content } = req.body ?? {};
    if (!receiverId || !content?.trim()) return res.status(400).json({ error: "receiverId and content required" });

    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.id, disputeId)).then(r => r[0]);
    if (!appeal) return res.status(404).json({ error: "Dispute not found" });

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, appeal.orderId)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (receiverId !== order.buyerId && receiverId !== order.sellerId) {
      return res.status(400).json({ error: "Receiver must be buyer or seller of this order" });
    }

    await db.insert(messagesTable).values({
      orderId: order.id,
      senderId: -1,
      receiverId,
      content: content.trim(),
      type: "admin",
      isRead: false,
    });

    await db.insert(notificationsTable).values({
      userId: receiverId,
      type: "system",
      title: "⚖️ Message from Admin",
      message: content.trim().slice(0, 80) + (content.length > 80 ? "..." : ""),
      relatedOrderId: order.id,
      isRead: false,
    });

    emitToUser(receiverId, "admin_message", { orderId: order.id });

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin send message failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

router.get("/notifications/history", adminAuth, async (req, res) => {
  try {
    const history = await db.select().from(notificationHistoryTable).orderBy(desc(notificationHistoryTable.sentAt)).limit(50);
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Admin notifications history failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/telegram/stats", adminAuth, async (req, res) => {
  try {
    const rows = await db.select({ count: sql<number>`count(*)::int` }).from(telegramUsersTable);
    res.json({ connected: rows[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Admin telegram stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/send", adminAuth, async (req: any, res) => {
  try {
    const { target, channel, title, message } = req.body ?? {};
    if (!title || !message) return res.status(400).json({ error: "Title and message required" });

    let users: any[] = [];
    if (target === "all") users = await db.select().from(usersTable);
    else if (target === "verified") users = await db.select().from(usersTable).where(eq(usersTable.kycStatus, "verified"));
    else if (target === "unverified") users = await db.select().from(usersTable).where(ne(usersTable.kycStatus, "verified"));
    else if (target?.startsWith("user:")) {
      const uid = parseInt(target.split(":")[1]);
      users = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    }

    const userIds = users.map(u => u.id);

    // Insert in-app notifications
    if (users.length > 0 && (channel === "in-app" || channel === "in-app+telegram")) {
      await db.insert(notificationsTable).values(users.map(u => ({ userId: u.id, type: "system", title, message }))).catch(() => {});
    }

    // Send Telegram broadcast (individual users via bot)
    let telegramCount = 0;
    if (channel === "telegram" || channel === "in-app+telegram") {
      const tgUsers = await db.select().from(telegramUsersTable);
      const tgFiltered = userIds.length > 0
        ? tgUsers.filter(t => userIds.includes(t.userId))
        : tgUsers;

      const APP_URL = process.env.APP_URL ?? "";
      const broadcastText = `📢 *${title}*\n\n${message}`;

      await Promise.allSettled(
        tgFiltered.map(t => sendTelegramMessage(t.telegramId, broadcastText, APP_URL || undefined))
      );
      telegramCount = tgFiltered.length;
    }

    // Send to Telegram Channel
    if (channel === "telegram-channel") {
      const chRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "telegramChannelId")).catch(() => [] as any[]);
      const channelId = chRows[0]?.value;
      if (channelId) {
        const broadcastText = `📢 *${title}*\n\n${message}`;
        await sendTelegramMessage(channelId, broadcastText, process.env.APP_URL || undefined).catch(() => {});
      }
    }

    // Send Email broadcast via Brevo
    let emailCount = 0;
    if (channel === "email") {
      const emailUsers = users.filter((u: any) => u.email && u.emailVerified);
      const settingRows = await db.select().from(systemSettingsTable).where(
        or(
          eq(systemSettingsTable.key, "brevoApiKey"),
          eq(systemSettingsTable.key, "brevoSenderEmail"),
          eq(systemSettingsTable.key, "brevoSenderName")
        )
      ).catch(() => [] as any[]);
      const sm: Record<string, string> = {};
      for (const r of settingRows) sm[r.key] = r.value;

      if (sm.brevoApiKey && emailUsers.length > 0) {
        const senderEmail = sm.brevoSenderEmail || "noreply@xendrx.com";
        const senderName = sm.brevoSenderName || "Xendrx";
        const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#080d18;color:#fff;border-radius:12px;padding:32px;"><div style="text-align:center;margin-bottom:24px;"><span style="font-size:24px;font-weight:700;color:#00e5ff;">Xendrx</span></div><h2 style="margin:0 0 8px;font-size:20px;">${title}</h2><p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</p><p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:24px;text-align:center;">Xendrx P2P Exchange</p></div>`;
        await Promise.allSettled(emailUsers.map((u: any) =>
          fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": sm.brevoApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: senderName, email: senderEmail },
              to: [{ email: u.email }],
              subject: title,
              htmlContent,
            }),
          }).catch(() => {})
        ));
        emailCount = emailUsers.length;
      }
    }

    // Send Web Push broadcast to subscribed users
    if (channel === "in-app" || channel === "in-app+telegram" || channel === "push") {
      sendPushBroadcast(userIds, `📢 ${title}`, message).catch(console.error);
    }

    const recipientCount = channel === "telegram" ? telegramCount : channel === "email" ? emailCount : channel === "telegram-channel" ? 1 : users.length;
    const [history] = await db.insert(notificationHistoryTable).values({
      title, message, target, channel, recipientCount, status: "sent",
    }).returning();
    await log(req.adminEmail, "send_notification", "notification", history.id, `${target} via ${channel}`);
    res.json({ success: true, recipientCount, telegramCount, emailCount });
  } catch (err) {
    req.log.error({ err }, "Admin send notification failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  platformName: "Xendrx",
  supportEmail: "",
  maintenanceMode: "false",
  etbRate: "",
  minDeposit: "1",
  minWithdrawal: "10",
  maxWithdrawalPerDay: "10000",
  requireKycForTrading: "true",
  requireKycForWithdrawal: "true",
  maxFailedLogins: "5",
  sessionTimeoutMinutes: "1440",
  bscAddress: "0x24c3AaC7A62a37333885Bc9a8A82ca4fDe7321B3",
  bep20Enabled: "true",
  fastsmsApiKey: "",
  brevoApiKey: "",
  brevoSenderEmail: "",
  brevoSenderName: "Xendrx",
  bscscanApiKey: "",
  telegramBotToken: "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "XendrxBot",
  telegramChannelId: "",
};

router.get("/settings", adminAuth, async (req, res) => {
  try {
    const rows = await db.select().from(systemSettingsTable);
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Admin settings get failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", adminAuth, async (req: any, res) => {
  try {
    const updates = req.body ?? {};
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(systemSettingsTable).values({ key, value: String(value), updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
    }
    await log(req.adminEmail, "update_settings", "settings", undefined, Object.keys(updates).join(", "));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin settings update failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── TELEGRAM BOT MANAGEMENT ─────────────────────────────────────────────────

router.get("/telegram/bot-status", adminAuth, async (_req, res) => {
  res.json(getBotStatus());
});

router.post("/telegram/apply-token", adminAuth, async (req: any, res) => {
  try {
    const { token, username } = req.body ?? {};
    if (!token?.trim()) return res.status(400).json({ error: "Bot token is required" });

    const info = await restartBotWithToken(token.trim(), username?.trim() || undefined);

    // Persist in DB settings
    await db.insert(systemSettingsTable).values({ key: "telegramBotToken", value: token.trim(), updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: token.trim(), updatedAt: new Date() } });
    await db.insert(systemSettingsTable).values({ key: "telegramBotUsername", value: info.username, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: info.username, updatedAt: new Date() } });

    await log(req.adminEmail, "update_telegram_bot", "settings", undefined, `@${info.username}`);
    res.json({ success: true, username: info.username });
  } catch (err: any) {
    const msg = err?.message ?? "Failed to start bot";
    res.status(400).json({ error: msg.includes("401") ? "Invalid bot token — check your token from @BotFather" : msg });
  }
});

// ─── FEES ────────────────────────────────────────────────────────────────────


// ─── TEST INTEGRATIONS ────────────────────────────────────────────────────────

router.post("/test-sms", adminAuth, async (req: any, res) => {
  try {
    const rows = await db.select().from(systemSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    const apiKey = settings["fastsmsApiKey"];
    if (!apiKey) return res.status(400).json({ ok: false, error: "FastSMS API key not configured." });
    const { phone } = req.body ?? {};
    if (!phone) return res.status(400).json({ ok: false, error: "phone is required" });
    const r = await fetch("https://fastsms.dev/api/p/sms/send", {
      method: "POST",
      headers: { "API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message: "Xendrx test message — your API key is working!" }),
    });
    const body = await r.text().catch(() => "");
    if (!r.ok) {
      if (r.status === 401) return res.json({ ok: false, error: "Authentication failed (401) — your API key is invalid or expired. Get a new key at fastsms.dev." });
      return res.json({ ok: false, error: `FastSMS returned ${r.status}: ${body}` });
    }
    res.json({ ok: true, message: "Test SMS sent successfully!" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

router.post("/test-email", adminAuth, async (req: any, res) => {
  try {
    const rows = await db.select().from(systemSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    const apiKey = settings["brevoApiKey"];
    const senderEmail = settings["brevoSenderEmail"] || "noreply@xendrx.com";
    const senderName = settings["brevoSenderName"] || "Xendrx";
    if (!apiKey) return res.status(400).json({ ok: false, error: "Brevo API key not configured." });
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ ok: false, error: "email is required" });
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: "Xendrx — Email Integration Test",
        htmlContent: `<div style="font-family:Arial;background:#080d18;color:#fff;padding:32px;border-radius:12px;"><h2 style="color:#00e5ff;">✅ Brevo is working!</h2><p>Your email integration is configured correctly for Xendrx.</p></div>`,
      }),
    });
    const body = await r.text().catch(() => "");
    if (!r.ok) {
      if (r.status === 401) return res.json({ ok: false, error: "Authentication failed (401) — your Brevo API key is invalid." });
      return res.json({ ok: false, error: `Brevo returned ${r.status}: ${body}` });
    }
    res.json({ ok: true, message: "Test email sent successfully!" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

router.post("/test-blockchain", adminAuth, async (req: any, res) => {
  try {
    const { provider, key } = req.body ?? {};
    if (!provider || provider !== "bscscan") {
      return res.status(400).json({ ok: false, error: "provider must be 'bscscan'" });
    }

    // BEP20 uses free public BSC RPC — no API key needed
    const { pingBscRpc } = await import("../lib/bsc.js");
    const result = await pingBscRpc();
    if (!result.ok) return res.json({ ok: false, error: "Could not reach BSC RPC node. Check server connectivity." });
    const block = result.blockNumber ? ` (block ${parseInt(result.blockNumber, 16).toLocaleString()})` : "";
    return res.json({ ok: true, message: `BSC public RPC reachable${block} — no API key needed.` });
  } catch (err: any) {
    if (err?.name === "TimeoutError") return res.json({ ok: false, error: "Request timed out — API may be unreachable." });
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// ─── DEPOSIT VERIFICATIONS ───────────────────────────────────────────────────

router.get("/deposits/verifications", adminAuth, async (req, res) => {
  try {
    const { status = "pending", page = "1" } = req.query as Record<string, string>;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    const rows = await db
      .select({
        v: depositVerificationsTable,
        user: {
          id: usersTable.id,
          username: usersTable.username,
          email: usersTable.email,
          phone: usersTable.phone,
          kycStatus: usersTable.kycStatus,
        },
        wallet: {
          availableBalance: walletsTable.availableBalance,
          depositAddress: walletsTable.depositAddress,
        },
      })
      .from(depositVerificationsTable)
      .leftJoin(usersTable, eq(depositVerificationsTable.userId, usersTable.id))
      .leftJoin(walletsTable, and(
        eq(walletsTable.userId, depositVerificationsTable.userId),
        eq(walletsTable.asset, "USDT"),
      ))
      .where(status === "all" ? undefined : eq(depositVerificationsTable.status, status))
      .orderBy(desc(depositVerificationsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ c: total }] = await db
      .select({ c: count() })
      .from(depositVerificationsTable)
      .where(status === "all" ? undefined : eq(depositVerificationsTable.status, status));

    res.json({ verifications: rows, total: Number(total), page: parseInt(page) });
  } catch (err) {
    req.log.error({ err }, "Admin deposit verifications list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/deposits/verifications/:id/approve", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body ?? {};

    const rows = await db.select().from(depositVerificationsTable).where(eq(depositVerificationsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "Verification not found" });
    const v = rows[0];
    if (v.status !== "pending") return res.status(400).json({ error: `Already ${v.status}` });
    if (!v.userId) return res.status(400).json({ error: "No user assigned to this deposit. Use 'Assign to User' first." });

    // Credit the wallet
    let walletRows = await db.select().from(walletsTable).where(
      and(eq(walletsTable.userId, v.userId), eq(walletsTable.asset, "USDT"))
    );
    let wallet = walletRows[0];
    if (!wallet) {
      const [w] = await db.insert(walletsTable).values({
        userId: v.userId, asset: "USDT", availableBalance: "0.00", frozenBalance: "0.00",
      }).returning();
      wallet = w;
    }
    const amount = parseFloat(v.amount ?? "0");
    if (amount <= 0) return res.status(400).json({ error: "Cannot approve: amount is zero or unknown. Use manual credit instead." });

    const newBalance = (parseFloat(wallet.availableBalance) + amount).toFixed(6);
    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      userId: v.userId, type: "deposit", amount: v.amount!,
      network: v.network, status: "completed", txid: v.txid,
    }).onConflictDoNothing();

    await db.update(depositVerificationsTable)
      .set({ status: "approved", reviewedAt: new Date(), reviewedBy: req.adminEmail, adminNote: note ?? null })
      .where(eq(depositVerificationsTable.id, id));

    await log(req.adminEmail, "deposit_approved", "deposit_verification", id, `Approved ${v.amount} USDT — txid: ${v.txid}`);
    res.json({ ok: true, newBalance });
  } catch (err) {
    req.log.error({ err }, "Admin deposit approve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/deposits/verifications/:id/reject", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body ?? {};
    const rows = await db.select().from(depositVerificationsTable).where(eq(depositVerificationsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    if (rows[0].status !== "pending") return res.status(400).json({ error: `Already ${rows[0].status}` });

    await db.update(depositVerificationsTable)
      .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: req.adminEmail, adminNote: note ?? null })
      .where(eq(depositVerificationsTable.id, id));

    await log(req.adminEmail, "deposit_rejected", "deposit_verification", id, note ?? "No reason given");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin deposit reject failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/deposits/verifications/:id/assign — assign an unmatched deposit to a user and credit them
router.post("/deposits/verifications/:id/assign", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userId: assignUserId, note } = req.body ?? {};
    if (!assignUserId) return res.status(400).json({ error: "userId is required" });

    const rows = await db.select().from(depositVerificationsTable).where(eq(depositVerificationsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "Verification not found" });
    const v = rows[0];
    if (v.status !== "pending") return res.status(400).json({ error: `Cannot assign — already ${v.status}` });

    const amount = parseFloat(v.amount ?? "0");
    if (amount <= 0) return res.status(400).json({ error: "Cannot assign: amount is zero or unknown" });

    // Credit the assigned user's wallet
    let walletRows = await db.select().from(walletsTable).where(
      and(eq(walletsTable.userId, assignUserId), eq(walletsTable.asset, "USDT"))
    );
    let wallet = walletRows[0];
    if (!wallet) {
      const [w] = await db.insert(walletsTable).values({
        userId: assignUserId, asset: "USDT", availableBalance: "0.00", frozenBalance: "0.00",
      }).returning();
      wallet = w;
    }
    const newBalance = (parseFloat(wallet.availableBalance) + amount).toFixed(6);
    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      userId: assignUserId, type: "deposit", amount: v.amount!,
      network: v.network, status: "completed", txid: v.txid,
    }).onConflictDoNothing();

    await db.update(depositVerificationsTable)
      .set({
        userId: assignUserId,
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: req.adminEmail,
        adminNote: note ?? `Manually assigned to user ${assignUserId} by admin`,
      })
      .where(eq(depositVerificationsTable.id, id));

    await log(req.adminEmail, "deposit_assigned", "deposit_verification", id, `Assigned ${v.amount} USDT to user ${assignUserId}`);
    res.json({ ok: true, newBalance });
  } catch (err) {
    req.log.error({ err }, "Admin deposit assign failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WALLET MANUAL CREDIT / DEBIT ────────────────────────────────────────────

router.post("/wallets/:userId/adjust", adminAuth, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { type, amount, note } = req.body ?? {};
    if (!["credit", "debit"].includes(type)) return res.status(400).json({ error: "type must be 'credit' or 'debit'" });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount must be a positive number" });

    let walletRows = await db.select().from(walletsTable).where(
      and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT"))
    );
    let wallet = walletRows[0];
    if (!wallet) {
      const [w] = await db.insert(walletsTable).values({
        userId, asset: "USDT", availableBalance: "0.00", frozenBalance: "0.00",
      }).returning();
      wallet = w;
    }

    const current = parseFloat(wallet.availableBalance);
    if (type === "debit" && amt > current) {
      return res.status(400).json({ error: `Insufficient balance. Available: ${current.toFixed(6)} USDT` });
    }

    const newBalance = type === "credit"
      ? (current + amt).toFixed(6)
      : (current - amt).toFixed(6);

    await db.update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      userId,
      type: "deposit",
      amount: amt.toFixed(6),
      network: "MANUAL",
      status: "completed",
      address: `admin:${type}:${req.adminEmail}`,
    });

    await log(req.adminEmail, `manual_wallet_${type}`, "user", userId, `${type} ${amt} USDT — ${note || "no note"}`);

    res.json({ ok: true, newBalance, type, amount: amt.toFixed(6) });
  } catch (err) {
    req.log.error({ err }, "Admin wallet adjust failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

router.get("/logs", adminAuth, async (req, res) => {
  try {
    const { page = "1" } = req.query as Record<string, string>;
    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;
    const logs = await db.select().from(adminLogsTable).orderBy(desc(adminLogsTable.createdAt)).limit(limit).offset(offset);
    const [{ c: total }] = await db.select({ c: count() }).from(adminLogsTable);
    res.json({ logs, total: Number(total), page: parseInt(page), limit });
  } catch (err) {
    req.log.error({ err }, "Admin logs list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CARD WAITLIST ───────────────────────────────────────────────────────────

router.get("/card/waitlist", adminAuth, async (req, res) => {
  try {
    const waitlist = await db.select().from(cardWaitlistTable).orderBy(desc(cardWaitlistTable.joinedAt));
    return res.json({ total: waitlist.length, users: waitlist });
  } catch (err) {
    req.log.error({ err }, "Admin card waitlist failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── FEE MANAGEMENT ──────────────────────────────────────────────────────────

router.get("/fees", adminAuth, async (req, res) => {
  try {
    const fees = await db.select().from(feeSettingsTable);
    const feeMap: Record<string, number> = {};
    fees.forEach(f => { feeMap[f.feeType] = Number(f.value); });

    const platformWalletRow = await db.select().from(platformWalletTable)
      .where(eq(platformWalletTable.asset, "USDT")).then(r => r[0]);

    return res.json({
      ...feeMap,
      totalCollected: Number(platformWalletRow?.totalCollected ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Admin fees fetch failed");
    return res.status(500).json({ error: "Failed to fetch fees" });
  }
});

router.patch("/fees", adminAuth, async (req, res) => {
  try {
    const { feeType, value } = req.body;

    const validTypes = ["maker_fee_percent", "taker_fee_percent", "withdrawal_fee_bep20"];
    if (!validTypes.includes(feeType)) {
      return res.status(400).json({ error: "Invalid fee type" });
    }

    if (typeof value !== "number" || value < 0) {
      return res.status(400).json({ error: "Fee value must be a non-negative number" });
    }
    const isPercent = feeType.endsWith("_percent");
    if (isPercent && value > 50) {
      return res.status(400).json({ error: "Percentage fee cannot exceed 50%" });
    }
    if (!isPercent && value > 1000) {
      return res.status(400).json({ error: "Withdrawal fee cannot exceed 1000 USDT" });
    }

    await db.insert(feeSettingsTable)
      .values({ feeType, value: String(value) })
      .onConflictDoUpdate({
        target: feeSettingsTable.feeType,
        set: { value: String(value), updatedAt: new Date() },
      });

    await log(req.adminEmail, "update_fee", "fee_settings", undefined, `Updated ${feeType} to ${value}`);

    return res.json({ message: "Fee updated successfully" });
  } catch (err) {
    req.log.error({ err }, "Admin fee update failed");
    return res.status(500).json({ error: "Failed to update fee" });
  }
});

// ─── Address Verifications Admin ──────────────────────────────────────────────

router.get("/address-verifications", adminAuth, async (req, res) => {
  try {
    const status = (req.query as any).status;
    const rows = await db.select({
      id: addressVerificationsTable.id,
      userId: addressVerificationsTable.userId,
      fullName: addressVerificationsTable.fullName,
      addressLine1: addressVerificationsTable.addressLine1,
      addressLine2: addressVerificationsTable.addressLine2,
      city: addressVerificationsTable.city,
      state: addressVerificationsTable.state,
      country: addressVerificationsTable.country,
      postalCode: addressVerificationsTable.postalCode,
      documentType: addressVerificationsTable.documentType,
      documentImageUrl: addressVerificationsTable.documentImageUrl,
      status: addressVerificationsTable.status,
      rejectionReason: addressVerificationsTable.rejectionReason,
      submittedAt: addressVerificationsTable.submittedAt,
      reviewedAt: addressVerificationsTable.reviewedAt,
      username: usersTable.username,
    })
      .from(addressVerificationsTable)
      .leftJoin(usersTable, eq(addressVerificationsTable.userId, usersTable.id))
      .where(status && status !== "all" ? eq(addressVerificationsTable.status, status) : undefined)
      .orderBy(desc(addressVerificationsTable.submittedAt));
    return res.json({ submissions: rows });
  } catch (err) {
    req.log.error({ err }, "Admin address-verifications list failed");
    return res.status(500).json({ message: "Failed to fetch" });
  }
});

router.patch("/address-verifications/:id/approve", adminAuth, async (req, res) => {
  try {
    const id = parseInt((req.params as any).id);
    const submission = await db.select().from(addressVerificationsTable)
      .where(eq(addressVerificationsTable.id, id)).then(r => r[0]);
    if (!submission) return res.status(404).json({ message: "Not found" });

    await db.update(addressVerificationsTable)
      .set({ status: "verified", reviewedAt: new Date() })
      .where(eq(addressVerificationsTable.id, id));

    await db.update(usersTable)
      .set({ addressVerified: true, addressVerifiedAt: new Date() } as any)
      .where(eq(usersTable.id, submission.userId));

    await db.insert(notificationsTable).values({
      userId: submission.userId,
      type: "address_verified",
      title: "✅ Address Verified!",
      message: "Your address has been verified successfully.",
      isRead: false,
    });

    await log((req as any).adminEmail, "approve_address", "address_verifications", id, `Approved address for user ${submission.userId}`);
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin address approve failed");
    return res.status(500).json({ message: "Failed to approve" });
  }
});

router.patch("/address-verifications/:id/reject", adminAuth, async (req, res) => {
  try {
    const id = parseInt((req.params as any).id);
    const { reason } = req.body;
    const submission = await db.select().from(addressVerificationsTable)
      .where(eq(addressVerificationsTable.id, id)).then(r => r[0]);
    if (!submission) return res.status(404).json({ message: "Not found" });

    await db.update(addressVerificationsTable)
      .set({ status: "rejected", rejectionReason: reason || "Not accepted", reviewedAt: new Date() })
      .where(eq(addressVerificationsTable.id, id));

    await db.insert(notificationsTable).values({
      userId: submission.userId,
      type: "address_rejected",
      title: "❌ Address Verification Rejected",
      message: `Reason: ${reason || "Not accepted"}. Please resubmit.`,
      isRead: false,
    });

    await log((req as any).adminEmail, "reject_address", "address_verifications", id, `Rejected address for user ${submission.userId}: ${reason}`);
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin address reject failed");
    return res.status(500).json({ message: "Failed to reject" });
  }
});

// POST /api/admin/deposits/credit-missed — manually credit a missed on-chain deposit
// Body: { depositAddress, txid, amount, userId? }
// If userId is omitted, looks up the user by wallets.deposit_address
router.post("/deposits/credit-missed", adminAuth, async (req: any, res) => {
  try {
    const { depositAddress, txid, amount, userId: bodyUserId } = req.body ?? {};
    if (!depositAddress || !txid || !amount) {
      return res.status(400).json({ error: "depositAddress, txid, and amount are required" });
    }
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // Check TX not already credited
    const existing = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.txid, txid), eq(transactionsTable.type, "deposit")));
    if (existing.length > 0) {
      return res.status(409).json({ error: "This TX hash has already been credited." });
    }

    // Find wallet — by userId if provided, otherwise by deposit address
    let walletRow: any;
    if (bodyUserId) {
      const rows = await db.select().from(walletsTable).where(eq(walletsTable.userId, Number(bodyUserId)));
      walletRow = rows[0];
    } else {
      const rows = await db.select().from(walletsTable).where(eq(walletsTable.depositAddress, depositAddress));
      if (rows.length === 0) {
        return res.status(404).json({ error: `No wallet found with deposit address ${depositAddress}. The user may need to visit their wallet page first to have their address assigned.` });
      }
      if (rows.length > 1) {
        return res.status(409).json({ error: "Multiple wallets share that deposit address — provide userId explicitly." });
      }
      walletRow = rows[0];
    }

    if (!walletRow) {
      return res.status(404).json({ error: "Wallet not found for that user." });
    }

    const userId = walletRow.userId;
    const amountStr = amountFloat.toFixed(6);

    // Credit the wallet
    const { creditUserDeposit } = await import("../lib/deposit-monitor.js");
    await creditUserDeposit(
      userId,
      walletRow.id,
      walletRow.availableBalance,
      amountStr,
      { txid, from: "manual-credit", to: depositAddress },
      false // no sweep for manual credits
    );

    await log(
      req.adminEmail,
      "manual_deposit_credit",
      "wallet",
      userId,
      `Manually credited ${amountStr} USDT for TX ${txid} at ${depositAddress}`
    );

    console.log(`[Admin] Manual credit: user ${userId} +${amountStr} USDT txid ${txid}`);
    return res.json({ success: true, userId, amount: amountStr, txid });
  } catch (err: any) {
    req.log.error({ err }, "Admin manual deposit credit failed");
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

// ─── EMAIL USERS ─────────────────────────────────────────────────────────────

router.get("/email/users", adminAuth, async (req, res) => {
  try {
    const all = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      emailVerified: usersTable.emailVerified,
      kycStatus: usersTable.kycStatus,
    }).from(usersTable);
    const filtered = all.filter((u: any) =>
      u.email &&
      !u.email.endsWith("@phone.xendrx.com") &&
      !u.email.endsWith("@phone.ethiop2p.com")
    );
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Admin email users failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/email/send", adminAuth, async (req: any, res) => {
  try {
    const { userIds, subject, body } = req.body ?? {};
    if (!Array.isArray(userIds) || userIds.length === 0)
      return res.status(400).json({ error: "userIds array required" });
    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: "subject and body are required" });

    const settingRows = await db.select().from(systemSettingsTable).where(
      or(
        eq(systemSettingsTable.key, "brevoApiKey"),
        eq(systemSettingsTable.key, "brevoSenderEmail"),
        eq(systemSettingsTable.key, "brevoSenderName")
      )
    ).catch(() => [] as any[]);
    const sm: Record<string, string> = {};
    for (const r of settingRows) sm[r.key] = r.value;

    if (!sm.brevoApiKey)
      return res.status(400).json({ error: "Brevo API key not configured in Settings." });

    const senderEmail = sm.brevoSenderEmail || "noreply@xendrx.com";
    const senderName = sm.brevoSenderName || "Xendrx";

    const users = await db.select().from(usersTable).where(
      inArray(usersTable.id, userIds)
    );

    const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#080d18;color:#fff;border-radius:12px;padding:32px;">
<div style="text-align:center;margin-bottom:24px;">
  <span style="font-size:26px;font-weight:700;color:#00e5ff;">xen<span style="color:#fff;">drx</span></span>
</div>
<h2 style="margin:0 0 16px;font-size:20px;color:#fff;">${subject.trim()}</h2>
<div style="color:rgba(255,255,255,.75);font-size:14px;line-height:1.7;white-space:pre-wrap;">${body.trim()}</div>
<hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:28px 0 16px;" />
<p style="color:rgba(255,255,255,.35);font-size:11px;text-align:center;margin:0;">Xendrx P2P Exchange &mdash; This email was sent from the admin panel.</p>
</div>`;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    await Promise.allSettled(
      users.map(async (u: any) => {
        if (!u.email || u.email.endsWith("@phone.xendrx.com") || u.email.endsWith("@phone.ethiop2p.com")) {
          return;
        }
        try {
          const r = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": sm.brevoApiKey.trim(), "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: senderName, email: senderEmail.trim() },
              to: [{ email: u.email, name: u.username }],
              subject: subject.trim(),
              htmlContent,
            }),
          });
          if (r.ok) {
            sent++;
            await db.insert(adminEmailSendsTable).values({
              adminEmail: req.adminEmail,
              userId: u.id,
              toEmail: u.email,
              subject: subject.trim(),
              body: body.trim(),
              status: "sent",
            }).catch(() => {});
          } else {
            const errText = await r.text().catch(() => `HTTP ${r.status}`);
            let errMsg = `HTTP ${r.status}`;
            try {
              const parsed = JSON.parse(errText);
              errMsg = parsed.message || parsed.error || errText;
            } catch { errMsg = errText; }
            failed++;
            errors.push(`${u.email}: ${errMsg}`);
            await db.insert(adminEmailSendsTable).values({
              adminEmail: req.adminEmail,
              userId: u.id,
              toEmail: u.email,
              subject: subject.trim(),
              body: body.trim(),
              status: "failed",
              error: errMsg.slice(0, 500),
            }).catch(() => {});
          }
        } catch (e: any) {
          failed++;
          const errMsg = e?.message ?? "network error";
          errors.push(`${u.email}: ${errMsg}`);
          await db.insert(adminEmailSendsTable).values({
            adminEmail: req.adminEmail,
            userId: u.id,
            toEmail: u.email,
            subject: subject.trim(),
            body: body.trim(),
            status: "failed",
            error: errMsg.slice(0, 500),
          }).catch(() => {});
        }
      })
    );

    await log(req.adminEmail, "send_user_email", "email", null, `${sent} sent, ${failed} failed — subject: ${subject.trim().slice(0, 80)}`);
    const allFailed = sent === 0 && failed > 0;
    res.json({
      success: !allFailed,
      sent,
      failed,
      error: allFailed ? errors[0] ?? "All emails failed to send" : undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Admin send user email failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/email/history", adminAuth, async (req, res) => {
  try {
    const rows = await db.select().from(adminEmailSendsTable)
      .orderBy(desc(adminEmailSendsTable.sentAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Admin email history failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Cards ───────────────────────────────────────────────────────────────────

// Helper to read card fee settings with defaults
async function getCardSettingsAdmin() {
  const rows = await db.select().from(systemSettingsTable).where(
    or(
      eq(systemSettingsTable.key, "cardCreationFee"),
      eq(systemSettingsTable.key, "cardInitialLoad"),
      eq(systemSettingsTable.key, "cardMinFund"),
    )
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    cardCreationFee: map.cardCreationFee ?? "2.00",
    cardInitialLoad: map.cardInitialLoad ?? "3.00",
    cardMinFund: map.cardMinFund ?? "2.00",
  };
}

router.get("/cards/settings", adminAuth, async (req, res) => {
  try {
    const settings = await getCardSettingsAdmin();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Admin card settings fetch failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/cards/settings", adminAuth, async (req, res) => {
  const { cardCreationFee, cardInitialLoad, cardMinFund } = req.body ?? {};
  const updates: Record<string, string> = {};
  if (cardCreationFee !== undefined) updates.cardCreationFee = String(parseFloat(cardCreationFee).toFixed(2));
  if (cardInitialLoad !== undefined) updates.cardInitialLoad = String(parseFloat(cardInitialLoad).toFixed(2));
  if (cardMinFund !== undefined) updates.cardMinFund = String(parseFloat(cardMinFund).toFixed(2));

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No settings provided" });

  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(systemSettingsTable).values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    await log(req.adminEmail, "update_card_settings", "system", null, JSON.stringify(updates));
    res.json(await getCardSettingsAdmin());
  } catch (err) {
    req.log.error({ err }, "Admin card settings update failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/cards", adminAuth, async (req, res) => {
  try {
    const cards = await db
      .select({
        id: cardsTable.id,
        userId: cardsTable.userId,
        cardId: cardsTable.cardId,
        cardUserId: cardsTable.cardUserId,
        customerId: cardsTable.customerId,
        nameOnCard: cardsTable.nameOnCard,
        cardStatus: cardsTable.cardStatus,
        cardNumber: cardsTable.cardNumber,
        last4: cardsTable.last4,
        cvv: cardsTable.cvv,
        expiry: cardsTable.expiry,
        balance: cardsTable.balance,
        createdAt: cardsTable.createdAt,
        updatedAt: cardsTable.updatedAt,
        userName: usersTable.username,
        userEmail: usersTable.email,
        userPhone: usersTable.phone,
      })
      .from(cardsTable)
      .leftJoin(usersTable, eq(cardsTable.userId, usersTable.id))
      .orderBy(desc(cardsTable.createdAt));
    res.json({ cards });
  } catch (err) {
    req.log.error({ err }, "Admin cards list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cards/link", adminAuth, async (req, res) => {
  const { userId, cardId } = req.body ?? {};
  if (!userId || !cardId) return res.status(400).json({ error: "userId and cardId are required" });

  const uid = parseInt(String(userId));
  if (isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });

  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, uid) });
    if (existing) return res.status(400).json({ error: `User already has a card (card_id: ${existing.cardId})` });

    // Fetch real card details from StroWallet
    function cleanKey(k: string | undefined) { return (k || "").replace(/\s+/g, ""); }
    const detailUrl = new URL("https://strowallet.com/api/bitvcard/fetch-nfccard-detail");
    detailUrl.searchParams.set("public_key", cleanKey(process.env.STROWALLET_PUBLIC_KEY));
    detailUrl.searchParams.set("secret_key", cleanKey(process.env.STROWALLET_SECRET_KEY));
    detailUrl.searchParams.set("card_id", String(cardId).trim());
    detailUrl.searchParams.set("mode", "live");

    let detail: any = null;
    try {
      const r = await fetch(detailUrl.toString());
      const raw = await r.json();
      console.log("[Admin] Link card StroWallet response:", JSON.stringify(raw));
      detail = raw?.response?.card_detail ?? raw?.response?.card ?? raw?.response ?? raw;
    } catch (e) {
      console.warn("[Admin] Link card: could not fetch from StroWallet — linking with provided card_id only");
    }

    function pick2(...vals: any[]): any {
      for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
      return null;
    }

    const cardNumber: string | null = pick2(detail?.card_number, detail?.pan);
    let last4: string | null = pick2(detail?.last4);
    if (!last4 && cardNumber) last4 = cardNumber.slice(-4);

    const [saved] = await db.insert(cardsTable).values({
      userId: uid,
      cardId: String(cardId).trim(),
      cardUserId: pick2(detail?.card_user_id, detail?.user_id),
      customerId: pick2(detail?.customer_id),
      nameOnCard: pick2(detail?.card_holder_name, detail?.name_on_card, user.username?.toUpperCase() ?? "LINKED CARD"),
      cardStatus: pick2(detail?.card_status, detail?.status) ?? "active",
      cardNumber,
      last4,
      cvv: pick2(detail?.cvv),
      expiry: pick2(detail?.expiry, detail?.expiry_date),
      balance: String(pick2(detail?.balance) ?? "0.00"),
    }).returning();

    await log(req.adminEmail, "link_card", "card", uid,
      `Linked card_id=${cardId} to user ${uid} (${user.email})`);

    res.json({ success: true, card: saved });
  } catch (err) {
    req.log.error({ err }, "Admin link card failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Card queue ──────────────────────────────────────────────────────────────

router.get("/cards/queue", adminAuth, async (req, res) => {
  try {
    const { cardQueueTable, usersTable } = await import("@workspace/db") as any;
    const { desc: descOrd, eq: eqOp } = await import("drizzle-orm") as any;
    const items = await db
      .select({
        id: cardQueueTable.id,
        userId: cardQueueTable.userId,
        cardId: cardQueueTable.cardId,
        type: cardQueueTable.type,
        amount: cardQueueTable.amount,
        status: cardQueueTable.status,
        errorMessage: cardQueueTable.errorMessage,
        attempts: cardQueueTable.attempts,
        createdAt: cardQueueTable.createdAt,
        updatedAt: cardQueueTable.updatedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(cardQueueTable)
      .leftJoin(usersTable, eqOp(usersTable.id, cardQueueTable.userId))
      .orderBy(descOrd(cardQueueTable.createdAt));
    res.json({ queue: items });
  } catch (err) {
    req.log.error({ err }, "Admin card queue list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/cards/merchant-balance", adminAuth, async (req, res) => {
  try {
    function cleanKey(k: string | undefined) { return (k || "").replace(/\s+/g, ""); }
    const pub = cleanKey(process.env.STROWALLET_PUBLIC_KEY);
    const url = new URL("https://strowallet.com/api/wallet/balance/USD/");
    url.searchParams.set("public_key", pub);
    const resp = await fetch(url.toString());
    const data = await resp.json();
    const balance = parseFloat(data?.balance ?? data?.data?.balance ?? "0") || 0;
    res.json({ success: true, balance, currency: "USD", raw: data });
  } catch (err) {
    req.log.error({ err }, "Admin merchant-balance failed");
    res.status(502).json({ error: "Could not fetch merchant balance" });
  }
});

router.post("/cards/process-queue", adminAuth, async (req, res) => {
  try {
    const { processCardQueue } = await import("../lib/card-queue.js") as any;
    processCardQueue().catch(console.error);
    res.json({ success: true, message: "Queue processing triggered" });
  } catch (err) {
    req.log.error({ err }, "Admin process queue failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Manual sweep trigger ────────────────────────────────────────────────────

router.post("/sweep-stuck-funds", adminAuth, async (req, res) => {
  try {
    const result = await sweepAllStuckFunds();
    await log(req.adminEmail, "sweep_stuck_funds", "system", null,
      `Manual sweep triggered — swept: ${result.swept}, failed: ${result.failed}`);
    res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "Admin sweep-stuck-funds failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
