import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    const all = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, (req as any).userId))
      .orderBy(desc(notificationsTable.createdAt));

    const unreadCount = all.filter(n => !n.isRead).length;
    const paginated = all.slice(offset, offset + limit);

    res.json({
      notifications: paginated,
      unreadCount,
      page,
      hasMore: paginated.length === limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const rows = await db.select().from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, (req as any).userId),
        eq(notificationsTable.isRead, false),
      ));
    res.json({ count: rows.length });
  } catch {
    res.json({ count: 0 });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.id, parseInt(req.params.id)),
        eq(notificationsTable.userId, (req as any).userId),
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, (req as any).userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all notifications read");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Keep legacy POST endpoint for backwards compat
router.post("/read-all", async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, (req as any).userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all notifications read");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(notificationsTable)
      .where(and(
        eq(notificationsTable.id, parseInt(req.params.id)),
        eq(notificationsTable.userId, (req as any).userId),
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete notification");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
