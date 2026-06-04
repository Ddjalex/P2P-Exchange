import { Router } from "express";
import { db } from "@workspace/db";
import { adsTable, usersTable, ordersTable } from "@workspace/db";
import { eq, and, or, gte, lte, desc, ne } from "drizzle-orm";

const router = Router();

async function formatAd(ad: any) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, ad.userId)).then(r => r[0]);
  const orders = await db.select().from(ordersTable).where(
    or(eq(ordersTable.buyerId, ad.userId), eq(ordersTable.sellerId, ad.userId))
  );
  const completed = orders.filter(o => o.status === "completed").length;
  const completionRate = orders.length > 0 ? ((completed / orders.length) * 100).toFixed(1) : "100.0";

  return {
    id: ad.id,
    userId: ad.userId,
    username: user?.username ?? "Unknown",
    isMerchant: user?.isMerchant ?? false,
    type: ad.type,
    asset: ad.asset,
    fiat: ad.fiat,
    priceType: ad.priceType,
    price: ad.price,
    floatingMargin: ad.floatingMargin ?? null,
    totalAmount: ad.totalAmount,
    availableAmount: ad.availableAmount,
    minLimit: ad.minLimit,
    maxLimit: ad.maxLimit,
    paymentMethods: JSON.parse(ad.paymentMethods),
    paymentTimeLimit: ad.paymentTimeLimit,
    autoReply: ad.autoReply ?? null,
    conditions: JSON.parse(ad.conditions),
    region: ad.region,
    status: ad.status,
    orderCount: orders.length,
    completionRate: `${completionRate}%`,
    createdAt: ad.createdAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const { type, payment_method, mine, status } = req.query as Record<string, string>;

    const conditions = [];
    if (mine === "true") {
      conditions.push(eq(adsTable.userId, (req as any).userId));
    } else {
      conditions.push(ne(adsTable.userId, (req as any).userId));
      if (!status) conditions.push(eq(adsTable.status, "online"));
    }
    if (type && ["buy", "sell"].includes(type)) {
      conditions.push(eq(adsTable.type, type as any));
    }
    if (status && ["online", "offline", "private"].includes(status)) {
      conditions.push(eq(adsTable.status, status as any));
    }

    const ads = await db.select().from(adsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adsTable.createdAt));

    const formatted = await Promise.all(ads.map(formatAd));

    // Filter by payment method if specified
    const filtered = payment_method
      ? formatted.filter(a => a.paymentMethods.includes(payment_method))
      : formatted;

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list ads");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      type, priceType, price, floatingMargin, totalAmount, minLimit, maxLimit,
      paymentMethods, paymentTimeLimit, autoReply, conditions, region, status
    } = req.body;

    const [ad] = await db.insert(adsTable).values({
      userId: (req as any).userId,
      type,
      priceType: priceType || "fixed",
      price,
      floatingMargin: floatingMargin ?? null,
      totalAmount,
      availableAmount: totalAmount,
      minLimit,
      maxLimit,
      paymentMethods: JSON.stringify(paymentMethods || []),
      paymentTimeLimit: paymentTimeLimit || 15,
      autoReply: autoReply ?? null,
      conditions: JSON.stringify(conditions || {}),
      region: region || "Ethiopia Only",
      status: status || "online",
    }).returning();

    res.status(201).json(await formatAd(ad));
  } catch (err) {
    req.log.error({ err }, "Failed to create ad");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, id)).then(r => r[0]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    res.json(await formatAd(ad));
  } catch (err) {
    req.log.error({ err }, "Failed to get ad");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      priceType, price, floatingMargin, totalAmount, minLimit, maxLimit,
      paymentMethods, paymentTimeLimit, autoReply, conditions, region, status
    } = req.body;

    const updates: Record<string, any> = {};
    if (priceType !== undefined) updates.priceType = priceType;
    if (price !== undefined) updates.price = price;
    if (floatingMargin !== undefined) updates.floatingMargin = floatingMargin;
    if (totalAmount !== undefined) { updates.totalAmount = totalAmount; updates.availableAmount = totalAmount; }
    if (minLimit !== undefined) updates.minLimit = minLimit;
    if (maxLimit !== undefined) updates.maxLimit = maxLimit;
    if (paymentMethods !== undefined) updates.paymentMethods = JSON.stringify(paymentMethods);
    if (paymentTimeLimit !== undefined) updates.paymentTimeLimit = paymentTimeLimit;
    if (autoReply !== undefined) updates.autoReply = autoReply;
    if (conditions !== undefined) updates.conditions = JSON.stringify(conditions);
    if (region !== undefined) updates.region = region;
    if (status !== undefined) updates.status = status;

    const [updated] = await db.update(adsTable).set(updates).where(eq(adsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Ad not found" });
    res.json(await formatAd(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update ad");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(adsTable).where(eq(adsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete ad");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/toggle-status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, id)).then(r => r[0]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    const newStatus = ad.status === "online" ? "offline" : "online";
    const [updated] = await db.update(adsTable).set({ status: newStatus }).where(eq(adsTable.id, id)).returning();
    res.json(await formatAd(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle ad status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
