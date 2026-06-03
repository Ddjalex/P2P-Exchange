import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentMethodsTable, ordersTable, feedbackTable } from "@workspace/db";
import { eq, and, or, gte, desc } from "drizzle-orm";

const router = Router();
const DEV_USER_ID = 1;

async function getProfileData(userId: number) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).then(r => r[0]);
  if (!user) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allOrders = await db.select().from(ordersTable).where(
    or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId))!
  );

  const recent = allOrders.filter(o => o.createdAt >= thirtyDaysAgo);
  const completedRecent = recent.filter(o => o.status === "completed");
  const completionRate30d = recent.length > 0
    ? ((completedRecent.length / recent.length) * 100).toFixed(2)
    : "100.00";

  const allFeedback = await db.select().from(feedbackTable).where(eq(feedbackTable.toUserId, userId));
  const positive = allFeedback.filter(f => f.type === "positive").length;
  const negative = allFeedback.filter(f => f.type === "negative").length;
  const totalFb = allFeedback.length;
  const positivePct = totalFb > 0 ? ((positive / totalFb) * 100).toFixed(1) : "100.0";
  const negativePct = totalFb > 0 ? ((negative / totalFb) * 100).toFixed(1) : "0.0";

  const firstOrder = allOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    kycStatus: user.kycStatus,
    isMerchant: user.isMerchant,
    emailVerified: user.emailVerified,
    smsVerified: user.smsVerified,
    addressVerified: user.addressVerified,
    trades30d: recent.length,
    completionRate30d: `${completionRate30d}%`,
    avgReleaseTime: "0.83 m",
    avgPayTime: "1.20 m",
    totalTrades: allOrders.length,
    positiveFeedbackPct: `${positivePct}%`,
    negativeFeedbackPct: `${negativePct}%`,
    feedbackCount: totalFb,
    firstTradeAt: firstOrder?.createdAt ?? null,
    notificationSettings: JSON.parse(user.notificationSettings),
    createdAt: user.createdAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const profile = await getProfileData(DEV_USER_ID);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", async (req, res) => {
  try {
    const { username } = req.body;
    const updates: Record<string, any> = {};
    if (username) updates.username = username;

    await db.update(usersTable).set(updates).where(eq(usersTable.id, DEV_USER_ID));
    const profile = await getProfileData(DEV_USER_ID);
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payment-methods", async (req, res) => {
  try {
    const methods = await db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.userId, DEV_USER_ID))
      .orderBy(desc(paymentMethodsTable.createdAt));

    res.json(methods.map(m => ({
      id: m.id,
      userId: m.userId,
      type: m.type,
      accountName: m.accountName,
      accountNumber: m.accountNumber,
      createdAt: m.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list payment methods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payment-methods", async (req, res) => {
  try {
    const { type, accountName, accountNumber } = req.body;
    const [method] = await db.insert(paymentMethodsTable).values({
      userId: DEV_USER_ID,
      type,
      accountName,
      accountNumber,
    }).returning();

    res.status(201).json({
      id: method.id,
      userId: method.userId,
      type: method.type,
      accountName: method.accountName,
      accountNumber: method.accountNumber,
      createdAt: method.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add payment method");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/payment-methods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(paymentMethodsTable).where(
      and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.userId, DEV_USER_ID))
    );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete payment method");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
