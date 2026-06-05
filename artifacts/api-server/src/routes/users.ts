import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ordersTable, adsTable, feedbackTable, followsTable } from "@workspace/db";
import { eq, or, and, desc } from "drizzle-orm";

const router = Router();

router.get("/:id/profile", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const viewerId = (req as any).userId;

    const user = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).then(r => r[0]);
    if (!user) return res.status(404).json({ message: "User not found" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const allOrders = await db.select().from(ordersTable).where(
      or(eq(ordersTable.buyerId, targetId), eq(ordersTable.sellerId, targetId))!
    );

    const completedOrders = allOrders.filter(o => o.status === "completed");
    const orders30d = allOrders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
    const completed30d = orders30d.filter(o => o.status === "completed");

    const sellerCompleted = completedOrders.filter(o => o.sellerId === targetId && o.releasedAt && o.paidAt);
    const avgReleaseMs = sellerCompleted.length > 0
      ? sellerCompleted.reduce((sum, o) => sum + (new Date(o.releasedAt!).getTime() - new Date(o.paidAt!).getTime()), 0) / sellerCompleted.length
      : 0;

    const buyerCompleted = completedOrders.filter(o => o.buyerId === targetId && o.paidAt);
    const avgPayMs = buyerCompleted.length > 0
      ? buyerCompleted.reduce((sum, o) => sum + (new Date(o.paidAt!).getTime() - new Date(o.createdAt).getTime()), 0) / buyerCompleted.length
      : 0;

    const counterparties = new Set(allOrders.map(o => o.buyerId === targetId ? o.sellerId : o.buyerId));

    const sortedCompleted = [...completedOrders].sort((a, b) =>
      new Date(a.completedAt ?? a.createdAt).getTime() - new Date(b.completedAt ?? b.createdAt).getTime()
    );
    const firstOrder = sortedCompleted[0];

    const registeredDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    const feedback = await db.select().from(feedbackTable)
      .where(eq(feedbackTable.toUserId, targetId))
      .orderBy(desc(feedbackTable.createdAt))
      .limit(30);

    const positiveFeedback = feedback.filter(f => f.type === "positive").length;
    const negativeFeedback = feedback.filter(f => f.type === "negative").length;

    const feedbackWithUsers = await Promise.all(feedback.map(async (fb) => {
      const fromUser = await db.select().from(usersTable).where(eq(usersTable.id, fb.fromUserId)).then(r => r[0]);
      return {
        id: fb.id,
        fromUserId: fb.fromUserId,
        fromUsername: fromUser?.username ?? "Unknown",
        type: fb.type,
        comment: fb.comment ?? null,
        createdAt: fb.createdAt,
      };
    }));

    const ads = await db.select().from(adsTable)
      .where(and(eq(adsTable.userId, targetId), eq(adsTable.status, "online")))
      .orderBy(desc(adsTable.createdAt));

    const formattedAds = ads.map(ad => ({
      id: ad.id,
      type: ad.type,
      price: ad.price,
      availableAmount: ad.availableAmount,
      minLimit: ad.minLimit,
      maxLimit: ad.maxLimit,
      paymentMethods: JSON.parse(ad.paymentMethods),
      paymentTimeLimit: ad.paymentTimeLimit,
    }));

    const isFollowing = viewerId && viewerId !== targetId
      ? await db.select().from(followsTable)
          .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, targetId)))
          .then(r => r.length > 0)
      : false;

    res.json({
      id: user.id,
      username: user.username,
      kycStatus: user.kycStatus,
      isMerchant: user.isMerchant,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt ?? null,
      registeredDays,
      verifications: {
        email: user.emailVerified,
        sms: user.smsVerified,
        kyc: user.kycStatus === "verified",
        address: user.addressVerified,
      },
      isFollowing,
      stats: {
        trades30d: orders30d.length,
        completionRate30d: orders30d.length > 0
          ? ((completed30d.length / orders30d.length) * 100).toFixed(1) + "%"
          : "100%",
        avgReleaseTimeMinutes: (avgReleaseMs / 60000).toFixed(2),
        avgPayTimeMinutes: (avgPayMs / 60000).toFixed(2),
        allTrades: completedOrders.length,
        buyTrades: buyerCompleted.length,
        sellTrades: sellerCompleted.length,
        tradingCounterparties: counterparties.size,
        firstTradeAt: firstOrder?.completedAt ?? null,
        positiveFeedback,
        negativeFeedback,
      },
      ads: formattedAds,
      feedback: feedbackWithUsers,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user profile");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
