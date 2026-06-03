import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, adsTable, usersTable, messagesTable, appealsTable, feedbackTable, walletsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";

const router = Router();
const DEV_USER_ID = 1;

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
  // Unfreeze from seller
  const sellerWallet = await getOrCreateWallet(sellerId);
  const sellerFrozen = parseFloat(sellerWallet.frozenBalance);
  await db.update(walletsTable).set({
    frozenBalance: Math.max(0, sellerFrozen - amount).toFixed(4),
  }).where(eq(walletsTable.userId, sellerId));
  // Add to buyer
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

// ── Format order ──────────────────────────────────────────────────────────────

async function formatOrder(order: any) {
  const buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
  const seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);
  const unreadCount = await db.select().from(messagesTable).where(
    and(eq(messagesTable.orderId, order.id), eq(messagesTable.receiverId, DEV_USER_ID), eq(messagesTable.isRead, false))
  ).then(r => r.length);

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
    sellerAccountName: "Abebe Tadesse",
    sellerAccountNumber: "1000" + order.sellerId + "234567",
  };
}

// ── LIST ORDERS ───────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { tab, status } = req.query as Record<string, string>;

    const conditions = [
      or(eq(ordersTable.buyerId, DEV_USER_ID), eq(ordersTable.sellerId, DEV_USER_ID))!
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

    const formatted = await Promise.all(filtered.map(formatOrder));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── CREATE ORDER ──────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const { adId, amountUsdt, amountEtb, paymentMethod } = req.body;
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, adId)).then(r => r[0]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });

    const isBuying = ad.type === "sell";
    const buyerId = isBuying ? DEV_USER_ID : ad.userId;
    const sellerId = isBuying ? ad.userId : DEV_USER_ID;

    const now = new Date();
    const appealAvailableAt = new Date(now.getTime() + ad.paymentTimeLimit * 60 * 1000 + 30 * 60 * 1000);

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

    // Freeze seller's USDT immediately
    await freezeSellerUsdt(sellerId, amountUsdt);

    // System message
    await db.insert(messagesTable).values({
      orderId: order.id,
      senderId: 0,
      receiverId: buyerId,
      content: "Your order has been created. Please complete the payment promptly.",
      type: "system",
      isRead: false,
    });

    res.status(201).json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET ORDER ─────────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── MARK PAID ─────────────────────────────────────────────────────────────────

router.post("/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Appeal unlocks 30 min after payment marked
    const appealAvailableAt = new Date(Date.now() + 30 * 60 * 1000);

    const [updated] = await db.update(ordersTable)
      .set({ status: "paid", paidAt: new Date(), appealAvailableAt })
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

    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to mark order paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── RELEASE CRYPTO ────────────────────────────────────────────────────────────

router.post("/:id/release", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const now = new Date();
    const [updated] = await db.update(ordersTable)
      .set({ status: "completed", completedAt: now, releasedAt: now })
      .where(eq(ordersTable.id, id))
      .returning();

    // Move USDT from seller frozen → buyer available
    await releaseUsdtToBuyer(order.sellerId, order.buyerId, order.amountUsdt);

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.buyerId,
      content: "Seller has released the crypto. Order is now completed!",
      type: "system",
      isRead: false,
    });

    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to release crypto");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────────────────────

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body || {};
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Only allow cancel if unpaid
    if (order.status !== "unpaid") {
      return res.status(400).json({ error: "Cannot cancel a paid order" });
    }

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", cancelReason: reason ?? null })
      .where(eq(ordersTable.id, id))
      .returning();

    // Return frozen USDT to seller
    await returnUsdtToSeller(order.sellerId, order.amountUsdt);

    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── APPEAL ────────────────────────────────────────────────────────────────────

router.post("/:id/appeal", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason, description, evidenceUrls = [] } = req.body;

    await db.update(ordersTable).set({ status: "appeal" }).where(eq(ordersTable.id, id));

    const [appeal] = await db.insert(appealsTable).values({
      orderId: id,
      raisedBy: DEV_USER_ID,
      reason,
      description,
      evidenceUrls: JSON.stringify(evidenceUrls),
      status: "pending",
    }).returning();

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: DEV_USER_ID,
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── FEEDBACK ──────────────────────────────────────────────────────────────────

router.post("/:id/feedback", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, comment } = req.body;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const toUserId = DEV_USER_ID === order.buyerId ? order.sellerId : order.buyerId;
    const [fb] = await db.insert(feedbackTable).values({
      orderId: id,
      fromUserId: DEV_USER_ID,
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PAYMENT DETAILS ───────────────────────────────────────────────────────────

router.get("/:id/payment-details", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({
      accountName: "Abebe Tadesse",
      accountNumber: "1000" + order.sellerId + "234567",
      paymentMethod: order.paymentMethod,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get payment details");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
