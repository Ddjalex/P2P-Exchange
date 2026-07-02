import app from "./app";
import { logger } from "./lib/logger";
import { startDepositMonitor } from "./lib/deposit-monitor";
import { startOrderExpiryMonitor, stopOrderExpiryMonitor } from "./lib/order-expiry";
import { startBot, stopBot } from "./telegram/bot.js";
import { startCardQueueProcessor } from "./lib/card-queue.js";
import { detectSuspiciousActivity } from "./middleware/security.js";
import { runWalletAlertMonitor } from "./routes/admin.js";
import { db } from "@workspace/db";
import { pushSubscriptions, systemSettingsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

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

  // Start Telegram bot — prefer env var, fall back to token stored in system_settings
  (async () => {
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    if (envToken) {
      startBot(envToken);
      return;
    }
    try {
      const rows = await db.select().from(systemSettingsTable)
        .where(eq(systemSettingsTable.key, "telegramBotToken"));
      const dbToken = rows[0]?.value?.trim();
      const dbUsername = undefined; // resolved by getMe inside startBot
      if (dbToken) {
        startBot(dbToken, dbUsername);
      } else {
        console.log("TELEGRAM_BOT_TOKEN not set — bot disabled");
      }
    } catch (err) {
      console.error("Failed to load Telegram bot token from DB:", err);
    }
  })();

  // Start card queue processor (retries queued fund/create requests every 5 min)
  startCardQueueProcessor();

  // Start suspicious activity detector (every 5 minutes)
  setTimeout(detectSuspiciousActivity, 10_000);
  setInterval(detectSuspiciousActivity, 5 * 60 * 1000);

  // Start wallet alert monitor — checks hot wallet levels, suspicious balances, stuck deposits
  setTimeout(runWalletAlertMonitor, 30_000);
  setInterval(runWalletAlertMonitor, 5 * 60 * 1000);

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
