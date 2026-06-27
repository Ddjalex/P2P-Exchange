import app from "./app";
import { logger } from "./lib/logger";
import { startDepositMonitor } from "./lib/deposit-monitor";
import { startOrderExpiryMonitor, stopOrderExpiryMonitor } from "./lib/order-expiry";
import { startBot, stopBot } from "./telegram/bot.js";
import { startCardQueueProcessor } from "./lib/card-queue.js";
import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["API_PORT"] ?? process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start blockchain deposit monitor
  startDepositMonitor();

  // Start 15-minute order expiry monitor
  startOrderExpiryMonitor();

  // Start Telegram bot (no-op if TELEGRAM_BOT_TOKEN not set)
  startBot();

  // Start card queue processor (retries queued fund/create requests every 5 min)
  startCardQueueProcessor();

  // Check push_subscriptions table exists and log row count
  db.select({ count: sql<number>`count(*)` })
    .from(pushSubscriptions)
    .then(([row]) => {
      logger.info({ count: Number(row?.count ?? 0) }, "[Push] push_subscriptions table OK");
    })
    .catch((err) => {
      logger.error({ err: String(err) }, "[Push] ERROR: push_subscriptions table missing or inaccessible — push notifications will not work");
    });
});

process.once("SIGTERM", () => { stopBot(); stopOrderExpiryMonitor(); });
process.once("SIGINT",  () => { stopBot(); stopOrderExpiryMonitor(); });
