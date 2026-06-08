import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "node:path";
import { mkdirSync } from "node:fs";

const uploadsDir = path.resolve(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// Trust the first proxy hop (Replit's reverse proxy / Vite dev proxy)
// Required for express-rate-limit to correctly read X-Forwarded-For headers
app.set("trust proxy", 1);

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

app.get("/", (_req, res) => res.json({ status: "ok" }));
app.use("/api", router);

export default app;
