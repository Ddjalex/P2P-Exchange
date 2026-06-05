import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "ethiop2p-dev-secret-change-in-production";

// Throttle lastActiveAt updates: track last write per userId (in-memory, resets on restart)
const lastActiveCache = new Map<number, number>();
const ACTIVE_UPDATE_THROTTLE_MS = 60_000; // write at most once per minute per user

export function userAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string | number };
    const userId = parseInt(String(decoded.sub), 10);
    if (!userId || isNaN(userId)) throw new Error("bad sub");
    (req as any).userId = userId;

    // Fire-and-forget: update lastActiveAt throttled to once per minute
    const now = Date.now();
    const last = lastActiveCache.get(userId) ?? 0;
    if (now - last > ACTIVE_UPDATE_THROTTLE_MS) {
      lastActiveCache.set(userId, now);
      db.update(usersTable)
        .set({ lastActiveAt: new Date() })
        .where(eq(usersTable.id, userId))
        .catch(() => {});
    }

    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
