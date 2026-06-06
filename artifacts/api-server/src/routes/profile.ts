import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentMethodsTable, ordersTable, feedbackTable, followsTable, blockedUsersTable, verificationCodesTable, telegramUsersTable } from "@workspace/db";
import { eq, and, or, gte, desc, gt } from "drizzle-orm";

const router = Router();

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
    phone: user.phone ?? null,
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
    const profile = await getProfileData((req as any).userId);
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

    await db.update(usersTable).set(updates).where(eq(usersTable.id, (req as any).userId));
    const profile = await getProfileData((req as any).userId);
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/profile/notifications — update notification settings
router.patch("/notifications", async (req, res) => {
  try {
    const { tradeAlerts, chatMessages, systemNotifications, emailNotifications, smsNotifications } = req.body;
    const userId = (req as any).userId;

    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).then(r => r[0]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const current = JSON.parse(user.notificationSettings);
    const updated = {
      ...current,
      ...(tradeAlerts !== undefined && { tradeAlerts }),
      ...(chatMessages !== undefined && { chatMessages }),
      ...(systemNotifications !== undefined && { systemNotifications }),
      ...(emailNotifications !== undefined && { emailNotifications }),
      ...(smsNotifications !== undefined && { smsNotifications }),
    };

    await db.update(usersTable)
      .set({ notificationSettings: JSON.stringify(updated) })
      .where(eq(usersTable.id, userId));

    res.json({ notificationSettings: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/profile/email — add/update email for phone-registered users
router.patch("/email", async (req, res) => {
  try {
    const { email, code } = req.body;
    const userId = (req as any).userId;

    if (!email || !code) return res.status(400).json({ error: "email and code are required" });

    const normalizedEmail = String(email).toLowerCase().trim();

    // Verify the OTP
    const now = new Date();
    const records = await db.select().from(verificationCodesTable)
      .where(and(
        eq(verificationCodesTable.target, normalizedEmail),
        eq(verificationCodesTable.code, String(code)),
        eq(verificationCodesTable.used, false),
        gt(verificationCodesTable.expiresAt, now),
      ));
    const record = records[records.length - 1];
    if (!record) return res.status(400).json({ error: "Invalid or expired verification code" });

    await db.update(verificationCodesTable).set({ used: true }).where(eq(verificationCodesTable.id, record.id));

    // Check email not taken by another user
    const existing = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, normalizedEmail)).then(r => r[0]);
    if (existing && existing.id !== userId) return res.status(409).json({ error: "Email already in use" });

    await db.update(usersTable)
      .set({ email: normalizedEmail, emailVerified: true })
      .where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update email");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/profile/feedback — received feedback list
router.get("/feedback", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const feedbacks = await db.select().from(feedbackTable)
      .where(eq(feedbackTable.toUserId, userId))
      .orderBy(desc(feedbackTable.createdAt));

    const fromUserIds = [...new Set(feedbacks.map(f => f.fromUserId))];
    const fromUsers = fromUserIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username })
          .from(usersTable)
          .where(or(...fromUserIds.map(id => eq(usersTable.id, id)))!)
      : [];
    const userMap = Object.fromEntries(fromUsers.map(u => [u.id, u.username]));

    res.json(feedbacks.map(f => ({
      id: f.id,
      type: f.type,
      comment: f.comment ?? null,
      fromUsername: userMap[f.fromUserId] ?? "Unknown",
      fromUserId: f.fromUserId,
      orderId: f.orderId,
      createdAt: f.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/profile/follows — list users this user follows
router.get("/follows", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const follows = await db.select().from(followsTable)
      .where(eq(followsTable.followerId, userId))
      .orderBy(desc(followsTable.createdAt));

    const followedIds = follows.map(f => f.followedId);
    const followedUsers = followedIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username, kycStatus: usersTable.kycStatus })
          .from(usersTable)
          .where(or(...followedIds.map(id => eq(usersTable.id, id)))!)
      : [];
    const userMap = Object.fromEntries(followedUsers.map(u => [u.id, u]));

    res.json(follows.map(f => ({
      id: f.id,
      followedId: f.followedId,
      username: userMap[f.followedId]?.username ?? "Unknown",
      kycStatus: userMap[f.followedId]?.kycStatus ?? "none",
      createdAt: f.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get follows");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile/follows/:userId
router.post("/follows/:userId", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const followedId = parseInt(req.params.userId);
    if (userId === followedId) return res.status(400).json({ error: "Cannot follow yourself" });

    const target = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, followedId)).then(r => r[0]);
    if (!target) return res.status(404).json({ error: "User not found" });

    await db.insert(followsTable).values({ followerId: userId, followedId }).onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to follow user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/profile/follows/:userId
router.delete("/follows/:userId", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const followedId = parseInt(req.params.userId);
    await db.delete(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followedId, followedId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unfollow user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/profile/blocked — list blocked users
router.get("/blocked", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const blocks = await db.select().from(blockedUsersTable)
      .where(eq(blockedUsersTable.blockerId, userId))
      .orderBy(desc(blockedUsersTable.createdAt));

    const blockedIds = blocks.map(b => b.blockedId);
    const blockedUsers = blockedIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username })
          .from(usersTable)
          .where(or(...blockedIds.map(id => eq(usersTable.id, id)))!)
      : [];
    const userMap = Object.fromEntries(blockedUsers.map(u => [u.id, u]));

    res.json(blocks.map(b => ({
      id: b.id,
      blockedId: b.blockedId,
      username: userMap[b.blockedId]?.username ?? "Unknown",
      createdAt: b.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get blocked users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile/blocked/:userId
router.post("/blocked/:userId", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const blockedId = parseInt(req.params.userId);
    if (userId === blockedId) return res.status(400).json({ error: "Cannot block yourself" });

    const target = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, blockedId)).then(r => r[0]);
    if (!target) return res.status(404).json({ error: "User not found" });

    await db.insert(blockedUsersTable).values({ blockerId: userId, blockedId }).onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to block user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/profile/blocked/:userId
router.delete("/blocked/:userId", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const blockedId = parseInt(req.params.userId);
    await db.delete(blockedUsersTable).where(and(eq(blockedUsersTable.blockerId, userId), eq(blockedUsersTable.blockedId, blockedId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unblock user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payment-methods", async (req, res) => {
  try {
    const methods = await db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.userId, (req as any).userId))
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
      userId: (req as any).userId,
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
      and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.userId, (req as any).userId))
    );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete payment method");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Telegram Link ─────────────────────────────────────────────────────────────

router.post("/link-telegram", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { telegramId, telegramUsername, telegramFirstName } = req.body ?? {};
    if (!telegramId) return res.status(400).json({ message: "telegramId required" });

    await db.insert(telegramUsersTable).values({
      userId,
      telegramId: String(telegramId),
      telegramUsername: telegramUsername ?? null,
      telegramFirstName: telegramFirstName ?? null,
    }).onConflictDoUpdate({
      target: telegramUsersTable.userId,
      set: {
        telegramId: String(telegramId),
        telegramUsername: telegramUsername ?? null,
        telegramFirstName: telegramFirstName ?? null,
        linkedAt: new Date(),
      },
    });

    return res.json({ success: true, message: "Telegram linked successfully!" });
  } catch (error) {
    console.error("Link telegram error:", error);
    return res.status(500).json({ message: "Failed to link Telegram" });
  }
});

router.delete("/unlink-telegram", async (req, res) => {
  try {
    await db.delete(telegramUsersTable)
      .where(eq(telegramUsersTable.userId, (req as any).userId));
    return res.json({ success: true, message: "Telegram unlinked" });
  } catch {
    return res.status(500).json({ message: "Failed to unlink" });
  }
});

router.get("/telegram-status", async (req, res) => {
  try {
    const tg = await db.select().from(telegramUsersTable)
      .where(eq(telegramUsersTable.userId, (req as any).userId))
      .then(r => r[0]);
    return res.json({
      linked: !!tg,
      telegramUsername: tg?.telegramUsername ?? null,
      linkedAt: tg?.linkedAt ?? null,
    });
  } catch {
    return res.json({ linked: false });
  }
});

export default router;
