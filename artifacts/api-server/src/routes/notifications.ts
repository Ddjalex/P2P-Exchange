import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const notifs = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, (req as any).userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifs.map(n => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, (req as any).userId));
    const count = rows.filter(n => !n.isRead).length;
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

router.post("/read-all", async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, (req as any).userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notifications read");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
