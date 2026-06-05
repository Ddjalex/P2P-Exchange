import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, adsTable, usersTable, messagesTable, appealsTable, feedbackTable, walletsTable, paymentMethodsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";

const router = Router();

// ── Wallet helpers ────────────────────────────────────────────────────────────

async function getOrCreateWallet(userId: number) {
  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).then(r => r[0]);
  if (!wallet) {
    const [w] = await db.insert(walletsTable).values({ userId, availableBalance: "0.00", frozenBalance: "0.00" }).returning();
    wallet = w;
  }
  return wallet;
}

async function freezeSellerUsdt(sellerId: number, amountUsdt: string) {
  const wallet = await getOrCreateWallet(sellerId);
  const available = parseFloat(wallet.availableBalance);
  const frozen = parseFloat(wallet.frozenBalance);
  const amount = parseFloat(amountUsdt);
  if (available >= amount) {
    await db.update(walletsTable).set({
      availableBalance: (available - amount).toFixed(4),
      frozenBalance: (frozen + amount).toFixed(4),
    }).where(eq(walletsTable.userId, sellerId));
  }
}

async function releaseUsdtToBuyer(sellerId: number, buyerId: number, amountUsdt: string) {
  const amount = parseFloat(amountUsdt);
  const sellerWallet = await getOrCreateWallet(sellerId);
  const sellerFrozen = parseFloat(sellerWallet.frozenBalance);
  await db.update(walletsTable).set({
    frozenBalance: Math.max(0, sellerFrozen - amount).toFixed(4),
  }).where(eq(walletsTable.userId, sellerId));
  const buyerWallet = await getOrCreateWallet(buyerId);
  const buyerAvailable = parseFloat(buyerWallet.availableBalance);
  await db.update(walletsTable).set({
    availableBalance: (buyerAvailable + amount).toFixed(4),
  }).where(eq(walletsTable.userId, buyerId));
}

async function returnUsdtToSeller(sellerId: number, amountUsdt: string) {
  const amount = parseFloat(amountUsdt);
  const wallet = await getOrCreateWallet(sellerId);
  const available = parseFloat(wallet.availableBalance);
  const frozen = parseFloat(wallet.frozenBalance);
  await db.update(walletsTable).set({
    availableBalance: (available + amount).toFixed(4),
    frozenBalance: Math.max(0, frozen - amount).toFixed(4),
  }).where(eq(walletsTable.userId, sellerId));
}

// ── Get seller payment details for a given payment method ─────────────────────

async function getSellerPaymentDetails(sellerId: number, paymentMethod: string): Promise<{ accountName: string; accountNumber: string }> {
  const methods = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.userId, sellerId));
  if (methods.length === 0) return { accountName: "", accountNumber: "" };

  // Try to match by type (case-insensitive prefix match)
  const pm = paymentMethod.toLowerCase().replace(/\s+/g, "");
  const match = methods.find(m => {
    const t = m.type.toLowerCase().replace(/\s+/g, "");
    return t === pm || pm.startsWith(t) || t.startsWith(pm);
  }) ?? methods[0];

  return { accountName: match.accountName, accountNumber: match.accountNumber };
}

// ── Format order ──────────────────────────────────────────────────────────────

async function formatOrder(order: any, viewerId?: number) {
  const buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
  const seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);

  let unreadCount = 0;
  if (viewerId) {
    unreadCount = await db.select().from(messagesTable).where(
      and(
        eq(messagesTable.orderId, order.id),
        eq(messagesTable.receiverId, viewerId),
        eq(messagesTable.isRead, false)
      )
    ).then(r => r.length);
  }

  const { accountName, accountNumber } = await getSellerPaymentDetails(order.sellerId, order.paymentMethod);

  return {
    id: order.id,
    adId: order.adId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    buyerUsername: buyer?.username ?? "Unknown",
    sellerUsername: seller?.username ?? "Unknown",
    amountUsdt: order.amountUsdt,
    amountEtb: order.amountEtb,
    price: order.price,
    paymentMethod: order.paymentMethod,
    paymentTimeLimit: order.paymentTimeLimit,
    status: order.status,
    cancelReason: order.cancelReason ?? null,
    unreadCount,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    completedAt: order.completedAt ?? null,
    frozenAt: order.frozenAt ?? null,
    releasedAt: order.releasedAt ?? null,
    appealAvailableAt: order.appealAvailableAt ?? null,
    adminNote: order.adminNote ?? null,
    sellerAccountName: accountName,
    sellerAccountNumber: accountNumber,
  };
}

// ── LIST ORDERS ───────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { tab, status } = req.query as Record<string, string>;
    const userId = (req as any).userId;

    const conditions = [
      or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId))!
    ];

    if (status && ["unpaid", "paid", "completed", "cancelled", "appeal"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as any));
    }

    const orders = await db.select().from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt));

    let filtered = orders;
    if (!status) {
      if (tab === "ongoing") {
        filtered = orders.filter(o => ["unpaid", "paid"].includes(o.status));
      } else if (tab === "fulfilled") {
        filtered = orders.filter(o => ["completed", "cancelled", "appeal"].includes(o.status));
      }
    }

    const formatted = await Promise.all(filtered.map(o => formatOrder(o, userId)));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CREATE ORDER ──────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const { adId, amountUsdt, amountEtb, paymentMethod } = req.body;
    const userId = (req as any).userId;

    if (!adId) return res.status(400).json({ message: "Advertisement not found" });
    if (!paymentMethod) return res.status(400).json({ message: "Please select a payment method" });

    const ad = await db.select().from(adsTable).where(eq(adsTable.id, adId)).then(r => r[0]);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });
    if (ad.status !== "online") return res.status(400).json({ message: "This ad is no longer available" });
    if (ad.userId === userId) return res.status(400).json({ message: "Cannot trade your own advertisement" });

    const etb = parseFloat(amountEtb);
    const minLimit = parseFloat(ad.minLimit);
    const maxLimit = parseFloat(ad.maxLimit);
    if (minLimit > 0 && etb < minLimit) return res.status(400).json({ message: `Minimum order amount is Br ${minLimit.toLocaleString()}` });
    if (maxLimit > 0 && etb > maxLimit) return res.status(400).json({ message: `Maximum order amount is Br ${maxLimit.toLocaleString()}` });

    const adPaymentMethods: string[] = JSON.parse(ad.paymentMethods);
    const pmLower = paymentMethod.toLowerCase().replace(/\s+/g, "");
    const validPm = adPaymentMethods.some(m => {
      const ml = m.toLowerCase().replace(/\s+/g, "");
      return ml === pmLower || ml.startsWith(pmLower) || pmLower.startsWith(ml);
    });
    if (!validPm) return res.status(400).json({ message: "Invalid payment method for this ad" });

    const usdt = parseFloat(amountUsdt);
    const available = parseFloat(ad.availableAmount);
    if (usdt > available) return res.status(400).json({ message: "Insufficient ad balance. Please reduce your amount." });

    const isBuying = ad.type === "sell";
    const buyerId = isBuying ? userId : ad.userId;
    const sellerId = isBuying ? ad.userId : userId;

    // USDT was already frozen when the ad was posted — only check ad.availableAmount (done above).
    // Do NOT re-check the wallet here; that balance is already frozen and will always appear low.

    const now = new Date();
    const appealAvailableAt = new Date(now.getTime() + ad.paymentTimeLimit * 60 * 1000);

    const [order] = await db.insert(ordersTable).values({
      adId,
      buyerId,
      sellerId,
      amountUsdt,
      amountEtb,
      price: ad.price,
      paymentMethod,
      paymentTimeLimit: ad.paymentTimeLimit,
      status: "unpaid",
      frozenAt: now,
      appealAvailableAt,
    }).returning();

    // Reduce ad available amount only — wallet was already frozen at ad-post time.
    await db.update(adsTable).set({
      availableAmount: Math.max(0, available - usdt).toFixed(4),
    }).where(eq(adsTable.id, adId));

    // System message
    await db.insert(messagesTable).values({
      orderId: order.id,
      senderId: 0,
      receiverId: buyerId,
      content: "Your order has been created. Please complete the payment promptly.",
      type: "system",
      isRead: false,
    });

    res.status(201).json(await formatOrder(order, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ message: "Order creation failed. Please try again." });
  }
});

// ── GET ORDER ─────────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(await formatOrder(order, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── MARK PAID ─────────────────────────────────────────────────────────────────

router.post("/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.buyerId !== userId) return res.status(403).json({ message: "Only the buyer can mark as paid" });
    if (order.status !== "unpaid") return res.status(400).json({ message: "Order is not in unpaid status" });

    const [updated] = await db.update(ordersTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.sellerId,
      content: "Buyer has marked payment as sent. Please verify and release crypto.",
      type: "system",
      isRead: false,
    });

    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to mark order paid");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── RELEASE CRYPTO ────────────────────────────────────────────────────────────

router.post("/:id/release", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.sellerId !== userId) return res.status(403).json({ message: "Only the seller can release crypto" });
    if (order.status !== "paid") return res.status(400).json({ message: "Order has not been marked as paid" });

    const now = new Date();
    const [updated] = await db.update(ordersTable)
      .set({ status: "completed", completedAt: now, releasedAt: now })
      .where(eq(ordersTable.id, id))
      .returning();

    await releaseUsdtToBuyer(order.sellerId, order.buyerId, order.amountUsdt);

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.buyerId,
      content: "Seller has released the crypto. Order is now completed!",
      type: "system",
      isRead: false,
    });

    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to release crypto");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────────────────────

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { reason } = req.body || {};
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "unpaid") return res.status(400).json({ message: "Cannot cancel a paid order" });

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", cancelReason: reason ?? null })
      .where(eq(ordersTable.id, id))
      .returning();

    await returnUsdtToSeller(order.sellerId, order.amountUsdt);

    // Restore ad available amount
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
    if (ad) {
      const restored = parseFloat(ad.availableAmount) + parseFloat(order.amountUsdt);
      const cap = parseFloat(ad.totalAmount);
      await db.update(adsTable).set({
        availableAmount: Math.min(restored, cap).toFixed(4),
      }).where(eq(adsTable.id, order.adId));
    }

    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── APPEAL ────────────────────────────────────────────────────────────────────

router.post("/:id/appeal", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { reason, description, evidenceUrls = [] } = req.body;

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "paid") return res.status(400).json({ message: "Appeals can only be raised on paid orders" });

    await db.update(ordersTable).set({ status: "appeal" }).where(eq(ordersTable.id, id));

    const [appeal] = await db.insert(appealsTable).values({
      orderId: id,
      raisedBy: userId,
      reason,
      description,
      evidenceUrls: JSON.stringify(evidenceUrls),
      status: "pending",
    }).returning();

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: userId,
      content: "An appeal has been raised. Admin is reviewing the dispute. USDT is frozen until resolved.",
      type: "system",
      isRead: false,
    });

    res.status(201).json({
      id: appeal.id,
      orderId: appeal.orderId,
      raisedBy: appeal.raisedBy,
      reason: appeal.reason,
      description: appeal.description,
      evidenceUrls: JSON.parse(appeal.evidenceUrls),
      status: appeal.status,
      adminDecision: appeal.adminDecision ?? null,
      createdAt: appeal.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to raise appeal");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── FEEDBACK ──────────────────────────────────────────────────────────────────

router.post("/:id/feedback", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { type, comment } = req.body;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "completed") return res.status(400).json({ message: "Can only leave feedback on completed orders" });

    const toUserId = userId === order.buyerId ? order.sellerId : order.buyerId;
    const [fb] = await db.insert(feedbackTable).values({
      orderId: id,
      fromUserId: userId,
      toUserId,
      type,
      comment: comment ?? null,
    }).returning();

    res.status(201).json({
      id: fb.id,
      orderId: fb.orderId,
      fromUserId: fb.fromUserId,
      toUserId: fb.toUserId,
      type: fb.type,
      comment: fb.comment ?? null,
      createdAt: fb.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PAYMENT DETAILS ───────────────────────────────────────────────────────────

router.get("/:id/payment-details", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const { accountName, accountNumber } = await getSellerPaymentDetails(order.sellerId, order.paymentMethod);
    res.json({ accountName, accountNumber, paymentMethod: order.paymentMethod });
  } catch (err) {
    req.log.error({ err }, "Failed to get payment details");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
