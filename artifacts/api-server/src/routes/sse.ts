import { Router } from "express";
import jwt from "jsonwebtoken";
import { addSseClient, removeSseClient } from "../lib/sse";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "swapbirr-dev-secret-change-in-production";

router.get("/events", (req, res) => {
  const token =
    (req.query.token as string | undefined) ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string | number };
    userId = parseInt(String(decoded.sub), 10);
    if (!userId || isNaN(userId)) throw new Error("Invalid sub");
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addSseClient(userId, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(":heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      removeSseClient(userId);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(userId);
  });
});

export default router;
