import { Router } from "express";
import { db } from "@workspace/db";
import { adsTable, usersTable, ordersTable, walletsTable, paymentMethodsTable } from "@workspace/db";
import { eq, and, ne, desc, asc, sql, gt } from "drizzle-orm";
import { notify } from "../lib/notify.js";

const router = Router();

// ── Wallet helper ─────────────────────────────────────────────────────────────

async function getOrCreateWallet(userId: number) {
  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).then(r => r[0]);
  if (!wallet) {
    const [w] = await db.insert(walletsTable).values({ userId, availableBalance: "0.00", frozenBalance: "0.00" }).returning();
    wallet = w;
  }
  return wallet;
}

// ── Format ad ─────────────────────────────────────────────────────────────────

async function formatAd(ad: any) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, ad.userId)).then(r => r[0]);
  const orders = await db.select().from(ordersTable).where(
    eq(ordersTable.adId, ad.id)
  );
  const completed = orders.filter(o => o.status === "completed").length;
  const completionRate = orders.length > 0 ? ((completed / orders.length) * 100).toFixed(1) : "100.0";

  const safeNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };
  return {
    id: ad.id,
    userId: ad.userId,
    username: user?.username ?? "Unknown",
    isMerchant: user?.isMerchant ?? false,
    type: ad.type,
    asset: ad.asset,
    fiat: ad.fiat,
    priceType: ad.priceType,
    price: safeNum(ad.price),
    floatingMargin: ad.floatingMargin ?? null,
    totalAmount: safeNum(ad.totalAmount),
    availableAmount: safeNum(ad.availableAmount),
    minLimit: safeNum(ad.minLimit),
    maxLimit: safeNum(ad.maxLimit),
    paymentMethods: (() => { try { return JSON.parse(ad.paymentMethods); } catch { return []; } })(),
    paymentTimeLimit: ad.paymentTimeLimit,
    autoReply: ad.autoReply ?? null,
    conditions: (() => { try { return JSON.parse(ad.conditions); } catch { return []; } })(),
    region: ad.region,
    status: ad.status,
    orderCount: orders.length,
    completionRate: `${completionRate}%`,
    createdAt: ad.createdAt,
  };
}

// ── LIST ADS ──────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { type, payment_method, min_amount, max_amount, mine, status } = req.query as Record<string, string>;
    const userId = (req as any).userId;

    const conditions: any[] = [];
    if (mine === "true") {
      conditions.push(eq(adsTable.userId, userId));
      if (status && ["online", "offline", "private"].includes(status)) {
        conditions.push(eq(adsTable.status, status as any));
      }
    } else {
      // Show all online ads — including the user's own so they can see their ad is live.
      // Self-trading is blocked at order-creation time by the backend.
      conditions.push(eq(adsTable.status, "online"));
      // Never show ads with zero, negative, or empty available balance in the marketplace
      conditions.push(sql`CAST(NULLIF(${adsTable.availableAmount}, '') AS NUMERIC) > 0`);
    }

    if (type && ["buy", "sell"].includes(type)) {
      conditions.push(eq(adsTable.type, type as any));
    }

    // Sort: marketplace buy ads → price asc (cheapest first), sell ads → price desc
    // For "mine", sort by createdAt desc
    const sortOrder = mine === "true"
      ? desc(adsTable.createdAt)
      : type === "sell"
        ? desc(adsTable.price)
        : asc(adsTable.price);

    const ads = await db.select().from(adsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder);

    const formatted = await Promise.all(ads.map(formatAd));

    let filtered = formatted;

    // Filter by payment method (case-insensitive partial match)
    if (payment_method) {
      const pmLower = payment_method.toLowerCase().replace(/\s+/g, "");
      filtered = filtered.filter(a =>
        a.paymentMethods.some((m: string) => {
          const ml = m.toLowerCase().replace(/\s+/g, "");
          return ml === pmLower || ml.includes(pmLower) || pmLower.includes(ml);
        })
      );
    }

    // Filter by ETB amount (ad limits must cover the requested amount)
    if (min_amount) {
      const amt = parseFloat(min_amount);
      filtered = filtered.filter(a => parseFloat(a.maxLimit) >= amt);
    }
    if (max_amount) {
      const amt = parseFloat(max_amount);
      filtered = filtered.filter(a => parseFloat(a.minLimit) <= amt);
    }

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list ads");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CREATE AD ─────────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const {
      type, priceType, price, floatingMargin, totalAmount, minLimit, maxLimit,
      paymentMethods, paymentTimeLimit, autoReply, conditions, region, status
    } = req.body;
    const userId = (req as any).userId;

    // Enforce 1 buy + 1 sell limit per user
    const existingAd = await db
      .select()
      .from(adsTable)
      .where(and(eq(adsTable.userId, userId), eq(adsTable.type, type)))
      .then(r => r[0]);
    if (existingAd) {
      return res.status(400).json({
        message: `You already have a ${type} ad. You can only have 1 buy ad and 1 sell ad at a time.`,
      });
    }

    // Validate payment methods are selected
    const pmArray: string[] = Array.isArray(paymentMethods) ? paymentMethods : [];
    if (pmArray.length === 0) {
      return res.status(400).json({ message: "Please select at least one payment method" });
    }

    // For sell ads: require the seller to have a saved payment method that MATCHES
    // at least one of the ad's selected payment methods (with non-empty account details)
    if (type === "sell") {
      const savedMethods = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.userId, userId));
      if (savedMethods.length === 0) {
        return res.status(400).json({ message: "You must add a payment method to your profile before posting a sell ad" });
      }
      const hasMatch = pmArray.some(adPm => {
        const adPmNorm = adPm.toLowerCase().replace(/\s+/g, "");
        return savedMethods.some(saved => {
          const savedNorm = saved.type.toLowerCase().replace(/\s+/g, "");
          const matches = savedNorm === adPmNorm || savedNorm.startsWith(adPmNorm) || adPmNorm.startsWith(savedNorm);
          return matches && saved.accountName?.trim() && saved.accountNumber?.trim();
        });
      });
      if (!hasMatch) {
        const missing = pmArray.join(", ");
        return res.status(400).json({ message: `Please add a ${missing} payment method with your account details in Profile → Payment Methods before posting this ad` });
      }
    }

    // For sell ads: check and freeze USDT immediately
    if (type === "sell") {
      const wallet = await getOrCreateWallet(userId);
      const available = parseFloat(wallet.availableBalance);
      const amount = parseFloat(totalAmount);
      if (available < amount) {
        return res.status(400).json({ message: "Insufficient USDT balance to post this sell ad" });
      }
      await db.update(walletsTable).set({
        availableBalance: (available - amount).toFixed(4),
        frozenBalance: (parseFloat(wallet.frozenBalance) + amount).toFixed(4),
      }).where(eq(walletsTable.userId, userId));
    }

    const [ad] = await db.insert(adsTable).values({
      userId,
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

    // Notify seller their USDT was frozen (sell ads only)
    if (type === "sell") {
      await notify({
        userId,
        type: "usdt_frozen",
        title: "🔒 USDT Locked",
        message: `${parseFloat(totalAmount).toFixed(4)} USDT has been locked as collateral for your sell ad.`,
      });
    }

    res.status(201).json(await formatAd(ad));
  } catch (err) {
    req.log.error({ err }, "Failed to create ad");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET AD ────────────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, id)).then(r => r[0]);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    res.json(await formatAd(ad));
  } catch (err) {
    req.log.error({ err }, "Failed to get ad");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── UPDATE AD ─────────────────────────────────────────────────────────────────

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
    if (!updated) return res.status(404).json({ message: "Ad not found" });
    res.json(await formatAd(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update ad");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE AD ─────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;

    const ad = await db.select().from(adsTable).where(eq(adsTable.id, id)).then(r => r[0]);
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    // Only the owner can delete their ad
    if (ad.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    // Block deletion if there are active orders on this ad
    const activeOrders = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(and(
        eq(ordersTable.adId, id),
        sql`${ordersTable.status} IN ('unpaid', 'paid', 'appeal')`
      ));
    if (activeOrders.length > 0) {
      return res.status(400).json({
        message: `Cannot delete this ad — there ${activeOrders.length === 1 ? "is 1 active order" : `are ${activeOrders.length} active orders`} in progress. Wait for all orders to complete or be cancelled first.`,
      });
    }

    // For sell ads: return the remaining available amount from frozen back to available
    if (ad.type === "sell") {
      const remainingAmount = parseFloat(ad.availableAmount ?? "0");
      if (remainingAmount > 0) {
        const wallet = await getOrCreateWallet(userId);
        const newFrozen = Math.max(0, parseFloat(wallet.frozenBalance) - remainingAmount);
        const newAvailable = parseFloat(wallet.availableBalance) + remainingAmount;
        await db.update(walletsTable).set({
          availableBalance: newAvailable.toFixed(4),
          frozenBalance: newFrozen.toFixed(4),
        }).where(eq(walletsTable.userId, userId));

        await notify({
          userId,
          type: "usdt_unfrozen",
          title: "🔓 USDT Returned",
          message: `${remainingAmount.toFixed(4)} USDT has been returned to your available balance after deleting your sell ad.`,
        });
      }
    }

    await db.delete(adsTable).where(eq(adsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete ad");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────

router.post("/:id/toggle-status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, id)).then(r => r[0]);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    const newStatus = ad.status === "online" ? "offline" : "online";
    const [updated] = await db.update(adsTable).set({ status: newStatus }).where(eq(adsTable.id, id)).returning();
    res.json(await formatAd(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle ad status");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
