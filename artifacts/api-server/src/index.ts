import app from "./app";
import { logger } from "./lib/logger";
import { startDepositMonitor } from "./lib/deposit-monitor";
import { startBot, stopBot } from "./telegram/bot.js";

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

  // Start Telegram bot (no-op if TELEGRAM_BOT_TOKEN not set)
  startBot();
});

process.once("SIGTERM", stopBot);
process.once("SIGINT", stopBot);
