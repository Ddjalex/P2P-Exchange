import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, adsTable } from "@workspace/db";
import { eq, and, or, gte } from "drizzle-orm";

const router = Router();

router.get("/overview", async (req, res) => {
  try {
    const allOrders = await db.select().from(ordersTable).where(
      or(eq(ordersTable.buyerId, (req as any).userId), eq(ordersTable.sellerId, (req as any).userId))!
    );

    const completed = allOrders.filter(o => o.status === "completed");
    const pending = allOrders.filter(o => ["unpaid", "paid"].includes(o.status));
    const completionRate = allOrders.length > 0
      ? ((completed.length / allOrders.length) * 100).toFixed(1)
      : "100.0";

    const totalVol = completed.reduce((sum, o) => sum + parseFloat(o.amountUsdt), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = completed.filter(o => o.completedAt && o.completedAt >= today).length;

    const activeAds = await db.select().from(adsTable).where(
      and(eq(adsTable.userId, (req as any).userId), eq(adsTable.status, "online"))
    ).then(r => r.length);

    res.json({
      totalVolume: totalVol.toFixed(2),
      totalOrders: allOrders.length,
      completionRate: `${completionRate}%`,
      activeAds,
      pendingOrders: pending.length,
      completedToday,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
