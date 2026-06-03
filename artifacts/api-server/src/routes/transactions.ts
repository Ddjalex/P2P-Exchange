import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();
const DEV_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const { type, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 20, 100);
    const off = parseInt(offset) || 0;

    const conditions = [eq(transactionsTable.userId, DEV_USER_ID)];
    if (type && ["deposit", "withdraw", "transfer"].includes(type)) {
      conditions.push(eq(transactionsTable.type, type as any));
    }

    const txs = await db.select().from(transactionsTable)
      .where(and(...conditions))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(lim)
      .offset(off);

    res.json(txs.map(t => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      network: t.network ?? null,
      status: t.status,
      txid: t.txid ?? null,
      address: t.address ?? null,
      fee: t.fee ?? null,
      createdAt: t.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
