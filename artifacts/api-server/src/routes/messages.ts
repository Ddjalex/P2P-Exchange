import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, ordersTable, usersTable } from "@workspace/db";
import { eq, and, or, desc, ne } from "drizzle-orm";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const myOrders = await db.select().from(ordersTable).where(
      or(eq(ordersTable.buyerId, (req as any).userId), eq(ordersTable.sellerId, (req as any).userId))!
    ).orderBy(desc(ordersTable.createdAt));

    const conversations = await Promise.all(myOrders.map(async order => {
      const traderId = order.buyerId === (req as any).userId ? order.sellerId : order.buyerId;
      const trader = await db.select().from(usersTable).where(eq(usersTable.id, traderId)).then(r => r[0]);
      const lastMsg = await db.select().from(messagesTable)
        .where(eq(messagesTable.orderId, order.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1)
        .then(r => r[0]);
      const unreadCount = await db.select().from(messagesTable).where(
        and(eq(messagesTable.orderId, order.id), eq(messagesTable.receiverId, (req as any).userId), eq(messagesTable.isRead, false))
      ).then(r => r.length);

      return {
        orderId: order.id,
        traderUsername: trader?.username ?? "Unknown",
        isMerchant: trader?.isMerchant ?? false,
        lastMessage: lastMsg?.content ?? "No messages yet",
        lastMessageAt: lastMsg?.createdAt ?? order.createdAt,
        unreadCount,
        orderStatus: order.status,
      };
    }));

    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.orderId, orderId))
      .orderBy(messagesTable.createdAt);

    const formatted = await Promise.all(msgs.map(async m => {
      const sender = m.senderId > 0
        ? await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).then(r => r[0])
        : null;
      return {
        id: m.id,
        orderId: m.orderId,
        senderId: m.senderId,
        senderUsername: sender?.username ?? "System",
        receiverId: m.receiverId,
        content: m.content,
        type: m.type,
        isRead: m.isRead,
        createdAt: m.createdAt,
      };
    }));

    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to get messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { content, type = "text" } = req.body;

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const receiverId = order.buyerId === (req as any).userId ? order.sellerId : order.buyerId;

    const [msg] = await db.insert(messagesTable).values({
      orderId,
      senderId: (req as any).userId,
      receiverId,
      content,
      type,
      isRead: false,
    }).returning();

    const sender = await db.select().from(usersTable).where(eq(usersTable.id, (req as any).userId)).then(r => r[0]);

    res.status(201).json({
      id: msg.id,
      orderId: msg.orderId,
      senderId: msg.senderId,
      senderUsername: sender?.username ?? "Unknown",
      receiverId: msg.receiverId,
      content: msg.content,
      type: msg.type,
      isRead: msg.isRead,
      createdAt: msg.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId/read", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(eq(messagesTable.orderId, orderId), eq(messagesTable.receiverId, (req as any).userId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark messages read");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
