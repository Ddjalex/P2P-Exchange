import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, ordersTable, usersTable } from "@workspace/db";
import { eq, and, or, desc, ne, inArray } from "drizzle-orm";
import { notify } from "../lib/notify.js";
import { PushNotify } from "./push.js";
import { TelegramNotify } from "../telegram/notify.js";
import { emitToUser } from "../lib/sse.js";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

const chatUploadsDir = path.resolve(process.cwd(), "uploads", "chat");
mkdirSync(chatUploadsDir, { recursive: true });

const chatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, randomBytes(16).toString("hex") + ext);
  },
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const myOrders = await db.select().from(ordersTable).where(
      or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId))!
    );

    const conversations = await Promise.all(myOrders.map(async order => {
      const traderId = order.buyerId === userId ? order.sellerId : order.buyerId;
      const isBuyer = order.buyerId === userId;
      const trader = await db.select().from(usersTable).where(eq(usersTable.id, traderId)).then(r => r[0]);
      const lastMsg = await db.select().from(messagesTable)
        .where(eq(messagesTable.orderId, order.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1)
        .then(r => r[0]);
      const unreadCount = await db.select().from(messagesTable).where(
        and(eq(messagesTable.orderId, order.id), eq(messagesTable.receiverId, userId), eq(messagesTable.isRead, false))
      ).then(r => r.length);

      return {
        orderId: order.id,
        traderId,
        traderUsername: trader?.username ?? "Unknown",
        isMerchant: trader?.isMerchant ?? false,
        isBuyer,
        amount: order.amount,
        lastMessage: lastMsg?.content ?? "",
        lastMessageAt: lastMsg?.createdAt ?? order.createdAt,
        unreadCount,
        orderStatus: order.status,
      };
    }));

    // Sort by lastMessageAt descending — one row per order, all visible
    conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// FIX 4 — unread message count across all orders (for badge)
router.get("/unread-count", async (req, res) => {
  try {
    const rows = await db.select().from(messagesTable).where(
      and(
        eq(messagesTable.receiverId, (req as any).userId),
        eq(messagesTable.isRead, false),
        ne(messagesTable.type, "system"),
      )
    );
    res.json({ count: rows.length });
  } catch {
    res.json({ count: 0 });
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

    // Notify receiver of new message
    await notify({
      userId: receiverId,
      type: "new_message",
      title: "💬 New Message",
      message: `${sender?.username ?? "Someone"}: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`,
      relatedOrderId: orderId,
    });
    PushNotify.newMessage(receiverId, orderId, sender?.username ?? "Someone", content).catch(console.error);
    TelegramNotify.newMessage(receiverId, orderId, sender?.username ?? "Someone", content).catch(console.error);
    emitToUser(receiverId, "new_message", { orderId, senderId: (req as any).userId, senderUsername: sender?.username ?? "Someone" });

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

router.post("/:orderId/image", chatUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const orderId = parseInt(req.params.orderId);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).then(r => r[0]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const imageUrl = `/uploads/chat/${req.file.filename}`;
    const receiverId = order.buyerId === (req as any).userId ? order.sellerId : order.buyerId;

    const [msg] = await db.insert(messagesTable).values({
      orderId,
      senderId: (req as any).userId,
      receiverId,
      content: imageUrl,
      type: "image",
      isRead: false,
    }).returning();

    const sender = await db.select().from(usersTable).where(eq(usersTable.id, (req as any).userId)).then(r => r[0]);

    // Notify receiver of image message
    await notify({
      userId: receiverId,
      type: "new_message",
      title: "💬 New Message",
      message: `${sender?.username ?? "Someone"} sent an image`,
      relatedOrderId: orderId,
    });
    emitToUser(receiverId, "new_message", { orderId, senderId: (req as any).userId, senderUsername: sender?.username ?? "Someone" });

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
      imageUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upload chat image");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId/read", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const userId = (req as any).userId;

    // Find counterparty from this order
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).then(r => r[0]);
    if (!order) return res.json({ success: true });

    const counterpartyId = order.buyerId === userId ? order.sellerId : order.buyerId;

    // Find ALL orders between these two users (in either role)
    const sharedOrders = await db.select({ id: ordersTable.id }).from(ordersTable).where(
      or(
        and(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, counterpartyId)),
        and(eq(ordersTable.buyerId, counterpartyId), eq(ordersTable.sellerId, userId)),
      )!
    );

    const orderIds = sharedOrders.map(o => o.id);
    if (orderIds.length > 0) {
      await db.update(messagesTable)
        .set({ isRead: true })
        .where(and(inArray(messagesTable.orderId, orderIds), eq(messagesTable.receiverId, userId)));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark messages read");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
