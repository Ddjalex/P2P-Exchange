import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, adsTable, usersTable, messagesTable, appealsTable, feedbackTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";

const router = Router();
const DEV_USER_ID = 1;

async function formatOrder(order: any) {
  const buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
  const seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);
  const unreadCount = await db.select().from(messagesTable).where(
    and(eq(messagesTable.orderId, order.id), eq(messagesTable.receiverId, DEV_USER_ID), eq(messagesTable.isRead, false))
  ).then(r => r.length);

  // Get seller payment method for payment instructions
  const sellerPaymentMethods = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);

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
    sellerAccountName: "Abebe Tadesse",
    sellerAccountNumber: "1000" + order.sellerId + "234567",
  };
}

router.get("/", async (req, res) => {
  try {
    const { tab, status } = req.query as Record<string, string>;

    const conditions = [
      or(eq(ordersTable.buyerId, DEV_USER_ID), eq(ordersTable.sellerId, DEV_USER_ID))!
    ];

    if (tab === "ongoing") {
      // ongoing = unpaid or paid
    } else if (tab === "fulfilled") {
      // fulfilled = completed, cancelled, appeal
    }

    if (status && ["unpaid", "paid", "completed", "cancelled", "appeal"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as any));
    } else if (tab === "ongoing") {
      // filter to unpaid + paid
    } else if (tab === "fulfilled") {
      // filter to completed + cancelled + appeal
    }

    const orders = await db.select().from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt));

    let filtered = orders;
    if (tab === "ongoing" && !status) {
      filtered = orders.filter(o => ["unpaid", "paid"].includes(o.status));
    } else if (tab === "fulfilled" && !status) {
      filtered = orders.filter(o => ["completed", "cancelled", "appeal"].includes(o.status));
    }

    const formatted = await Promise.all(filtered.map(formatOrder));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { adId, amountUsdt, amountEtb, paymentMethod } = req.body;
    const ad = await db.select().from(adsTable).where(eq(adsTable.id, adId)).then(r => r[0]);
    if (!ad) return res.status(404).json({ error: "Ad not found" });

    const isBuying = ad.type === "sell"; // user buys from a sell ad
    const buyerId = isBuying ? DEV_USER_ID : ad.userId;
    const sellerId = isBuying ? ad.userId : DEV_USER_ID;

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
    }).returning();

    // Add system message
    await db.insert(messagesTable).values({
      orderId: order.id,
      senderId: 0,
      receiverId: buyerId,
      content: "Order created. Please complete payment within the time limit.",
      type: "system",
      isRead: false,
    });

    res.status(201).json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.post("/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.update(ordersTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) return res.status(404).json({ error: "Order not found" });

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.sellerId,
      content: "Buyer has marked payment as sent. Please verify and release crypto.",
      type: "system",
      isRead: false,
    });

    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to mark order paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/release", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.update(ordersTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) return res.status(404).json({ error: "Order not found" });

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.buyerId,
      content: "Seller released crypto. Order is now completed!",
      type: "system",
      isRead: false,
    });

    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to release crypto");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body || {};
    const [order] = await db.update(ordersTable)
      .set({ status: "cancelled", cancelReason: reason ?? null })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

export default router;
