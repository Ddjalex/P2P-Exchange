import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, ordersTable, adsTable, feedbackTable, followsTable } from "@workspace/db";
import { eq, or, and, desc } from "drizzle-orm";

const router = Router();

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes = "online"

// ── GET /api/users/:id/status — lightweight online status check ───────────────
router.get("/:id/status", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

    const row = await db
      .select({ lastActiveAt: usersTable.lastActiveAt })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .then(r => r[0]);

    if (!row) return res.status(404).json({ message: "Not found" });

    const online = row.lastActiveAt
      ? Date.now() - new Date(row.lastActiveAt).getTime() < ONLINE_THRESHOLD_MS
      : false;

    return res.json({ online, lastActiveAt: row.lastActiveAt ?? null });
  } catch (err: any) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id/profile", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const viewerId = (req as any).userId;

    console.log("Fetching profile for userId:", targetId);

    // Step 1: Get user
    const user = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).then(r => r[0]);
    if (!user) return res.status(404).json({ message: "User not found" });

    console.log("User found:", !!user);

    // Step 2: Get orders for stats
    let allOrders: any[] = [];
    try {
      allOrders = await db.select().from(ordersTable).where(
        or(eq(ordersTable.buyerId, targetId), eq(ordersTable.sellerId, targetId))!
      );
    } catch (e) {
      console.error("Failed to fetch orders:", e);
      allOrders = [];
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completedOrders = allOrders.filter(o => o.status === "completed");
    const orders30d = allOrders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
    const completed30d = orders30d.filter(o => o.status === "completed");

    const sellerCompleted = completedOrders.filter(o => o.sellerId === targetId && o.releasedAt && o.paidAt);
    const avgReleaseMs = sellerCompleted.length > 0
      ? sellerCompleted.reduce((sum: number, o: any) => sum + (new Date(o.releasedAt!).getTime() - new Date(o.paidAt!).getTime()), 0) / sellerCompleted.length
      : 0;

    const buyerCompleted = completedOrders.filter(o => o.buyerId === targetId && o.paidAt);
    const avgPayMs = buyerCompleted.length > 0
      ? buyerCompleted.reduce((sum: number, o: any) => sum + (new Date(o.paidAt!).getTime() - new Date(o.createdAt).getTime()), 0) / buyerCompleted.length
      : 0;

    const counterparties = new Set(allOrders.map(o => o.buyerId === targetId ? o.sellerId : o.buyerId));

    const sortedCompleted = [...completedOrders].sort((a, b) =>
      new Date(a.completedAt ?? a.createdAt).getTime() - new Date(b.completedAt ?? b.createdAt).getTime()
    );
    const firstOrder = sortedCompleted[0];

    const registeredDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Step 3: Get feedback — wrapped in try/catch
    let feedbackWithUsers: any[] = [];
    let positiveFeedback = 0;
    let negativeFeedback = 0;
    try {
      const feedback = await db.select().from(feedbackTable)
        .where(eq(feedbackTable.toUserId, targetId))
        .orderBy(desc(feedbackTable.createdAt))
        .limit(30);

      positiveFeedback = feedback.filter(f => f.type === "positive").length;
      negativeFeedback = feedback.filter(f => f.type === "negative").length;

      feedbackWithUsers = await Promise.all(feedback.map(async (fb) => {
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
    } catch (e) {
      console.error("Failed to fetch feedback:", e);
    }

    console.log("Feedback count:", feedbackWithUsers.length);

    // Step 4: Get ads — wrapped in try/catch
    let formattedAds: any[] = [];
    try {
      const ads = await db.select().from(adsTable)
        .where(and(eq(adsTable.userId, targetId), eq(adsTable.status, "online")))
        .orderBy(desc(adsTable.createdAt));

      formattedAds = ads.map(ad => ({
        id: ad.id,
        type: ad.type,
        price: ad.price,
        availableAmount: ad.availableAmount,
        minLimit: ad.minLimit,
        maxLimit: ad.maxLimit,
        paymentMethods: (() => { try { return JSON.parse(ad.paymentMethods); } catch { return []; } })(),
        paymentTimeLimit: ad.paymentTimeLimit,
      }));
    } catch (e) {
      console.error("Failed to fetch user ads:", e);
    }

    console.log("Ads count:", formattedAds.length);

    // Step 5: Check follow status
    let isFollowing = false;
    try {
      isFollowing = viewerId && viewerId !== targetId
        ? await db.select().from(followsTable)
            .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followedId, targetId)))
            .then(r => r.length > 0)
        : false;
    } catch (e) {
      console.error("Failed to fetch follow status:", e);
    }

    return res.json({
      id: user.id,
      username: user.username,
      kycStatus: user.kycStatus ?? "none",
      isMerchant: user.isMerchant ?? false,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt ?? null,
      registeredDays,
      verifications: {
        email: !!user.emailVerified,
        sms: !!user.smsVerified,
        kyc: user.kycStatus === "verified",
        address: !!user.addressVerified,
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

  } catch (err: any) {
    console.error("Trader profile error:", err);
    req.log?.error({ err }, "Failed to get user profile");
    return res.status(500).json({
      message: "Internal server error",
      detail: err?.message ?? "Unknown error",
    });
  }
});

export default router;
