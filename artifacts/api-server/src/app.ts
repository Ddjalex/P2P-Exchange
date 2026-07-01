import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "node:path";
import fs, { mkdirSync } from "node:fs";

// UPLOADS_DIR env var lets the VPS override the path (e.g. /root/app/xendrx/uploads).
// Falls back to <cwd>/uploads for local/dev use.
const uploadsDir = process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// Trust the first proxy hop (Replit's reverse proxy / Vite dev proxy)
// Required for express-rate-limit to correctly read X-Forwarded-For headers
app.set("trust proxy", 1);

// Serve uploaded files via express.static — avoids Express 5 route-param issues.
// /api/files/kyc/filename.jpg  →  <uploadsDir>/kyc/filename.jpg
app.use(
  "/api/files",
  (req: any, res: any, next: any) => {
    console.log("[Files] Request:", req.path, "→", path.join(uploadsDir, req.path));
    const safePath = path.normalize(req.path);
    if (safePath.includes("..")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  },
  express.static(uploadsDir, { fallthrough: false }),
);

// 404 handler for missing files under /api/files
app.use("/api/files", (err: any, _req: any, res: any, next: any) => {
  if (err.status === 404) {
    return res.status(404).json({ error: "File not found" });
  }
  next(err);
});

// Keep /uploads for backward compatibility with existing DB records
app.use("/uploads", express.static(uploadsDir));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit — 100 req/min per IP
const globalLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimit);

// Strict financial rate limit — 5 req/min per user/IP
const financialLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => `financial_${req.userId || "anon"}`,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many financial requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/wallet/withdraw", financialLimit);
app.use("/api/wallet/internal-transfer", financialLimit);
app.use("/api/cards/fund", financialLimit);
app.use("/api/cards/withdraw", financialLimit);
app.use("/api/cards/create", financialLimit);

// Security headers — applied to every response (Nginx handles X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, CSP)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.removeHeader("X-Powered-By");
  next();
});

app.get("/", (_req, res) => res.json({ status: "ok" }));
app.use("/api", router);

export default app;
