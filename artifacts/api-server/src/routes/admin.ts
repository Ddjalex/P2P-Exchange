import { Router } from "express";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { emitToUser } from "../lib/sse";
import { db } from "@workspace/db";
import {
  usersTable, adsTable, ordersTable, kycSubmissionsTable, appealsTable,
  transactionsTable, walletsTable, messagesTable, notificationsTable,
  adminLogsTable, systemSettingsTable, notificationHistoryTable, fraudFlagsTable,
  depositVerificationsTable, cardWaitlistTable, feeSettingsTable, platformWalletTable,
  feeTransactionsTable,
} from "@workspace/db";
import { eq, desc, and, or, ilike, sql, ne, count } from "drizzle-orm";
import { getFeePercents, calculateFees } from "../helpers/fees.js";

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
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (email !== adminEmail || password !== adminPassword)
      return res.status(401).json({ error: "Invalid credentials" });
    const token = sign({ email, iat: Date.now() }, getSecret());
    res.json({ token, admin: { email } });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
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
    await db.update(adsTable).set({ status: "online" }).where(eq(adsTable.id, id));
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
    res.json({ totalAvailable: totalAvailable.toFixed(2), totalFrozen: totalFrozen.toFixed(2), totalUsdt: (totalAvailable + totalFrozen).toFixed(2), pendingWithdrawals: Number(pending.c) });
  } catch (err) {
    req.log.error({ err }, "Admin wallet overview failed");
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
    await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
    await log(req.adminEmail, "approve_withdrawal", "transaction", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin approve withdrawal failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/wallet/transactions/:id/reject", adminAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const tx = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).then(r => r[0]);
    if (tx) {
      await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.id, id));
      const wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.userId)).then(r => r[0]);
      if (wallet) {
        const newBalance = (parseFloat(wallet.availableBalance) + parseFloat(tx.amount)).toFixed(2);
        await db.update(walletsTable).set({ availableBalance: newBalance }).where(eq(walletsTable.userId, tx.userId));
      }
    }
    await log(req.adminEmail, "reject_withdrawal", "transaction", id);
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

    emitToUser(receiverId, { type: "admin_message", orderId: order.id });

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
    // Insert in-app notifications for all targets
    if (users.length > 0 && (channel === "in-app" || channel === "both")) {
      await db.insert(notificationsTable).values(users.map(u => ({ userId: u.id, type: "system", title, message }))).catch(() => {});
    }
    const [history] = await db.insert(notificationHistoryTable).values({ title, message, target, channel, recipientCount: users.length, status: "sent" }).returning();
    await log(req.adminEmail, "send_notification", "notification", history.id, `${target} via ${channel}`);
    res.json({ success: true, recipientCount: users.length });
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
  trc20Address: "",
  erc20Address: "",
  trc20Enabled: "true",
  erc20Enabled: "true",
  fastsmsApiKey: "",
  brevoApiKey: "",
  brevoSenderEmail: "",
  brevoSenderName: "Xendrx",
  trongridApiKey: "",
  bscscanApiKey: "",
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
    if (!provider || !["trongrid", "bscscan"].includes(provider)) {
      return res.status(400).json({ ok: false, error: "provider must be 'trongrid' or 'bscscan'" });
    }
    if (!key || typeof key !== "string" || key.trim().length < 8) {
      return res.status(400).json({ ok: false, error: "A valid API key is required." });
    }
    const apiKey = key.trim();

    if (provider === "trongrid") {
      // Use the USDT contract account as a known-good address to query
      const r = await fetch("https://api.trongrid.io/v1/accounts/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", {
        headers: { "TRON-PRO-API-KEY": apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await r.json().catch(() => ({})) as any;
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          return res.json({ ok: false, error: "Authentication failed — this API key is invalid or expired." });
        }
        return res.json({ ok: false, error: `TronGrid returned HTTP ${r.status}.` });
      }
      // TronGrid returns { data: [...], success: true } on success
      if (body?.success === false) {
        return res.json({ ok: false, error: body?.error?.message || "TronGrid rejected the request." });
      }
      return res.json({ ok: true, message: "TronGrid API key is valid and working." });
    }

    if (provider === "bscscan") {
      // BEP20 uses free public BSC RPC — no API key needed
      const { pingBscRpc } = await import("../lib/bsc.js");
      const result = await pingBscRpc();
      if (!result.ok) return res.json({ ok: false, error: "Could not reach BSC RPC node. Check server connectivity." });
      const block = result.blockNumber ? ` (block ${parseInt(result.blockNumber, 16).toLocaleString()})` : "";
      return res.json({ ok: true, message: `BSC public RPC reachable${block} — no API key needed.` });
    }
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

    const validTypes = ["maker_fee_percent", "taker_fee_percent", "withdrawal_fee_trc20", "withdrawal_fee_erc20"];
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

    await db.update(feeSettingsTable)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(feeSettingsTable.feeType, feeType));

    await log(req.adminEmail, "update_fee", "fee_settings", undefined, `Updated ${feeType} to ${value}`);

    return res.json({ message: "Fee updated successfully" });
  } catch (err) {
    req.log.error({ err }, "Admin fee update failed");
    return res.status(500).json({ error: "Failed to update fee" });
  }
});

export default router;
