import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "ethiop2p-dev-secret-change-in-production";

export function userAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string | number };
    (req as any).userId = parseInt(String(decoded.sub), 10);
    if (!(req as any).userId || isNaN((req as any).userId)) throw new Error("bad sub");
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
