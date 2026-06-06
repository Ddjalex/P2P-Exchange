import { Telegraf, Markup } from "telegraf";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL = process.env.APP_URL ?? "";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "XendrxBot";

export const bot = new Telegraf(TOKEN);

bot.command("start", async (ctx) => {
  const firstName = ctx.from?.first_name ?? "Trader";
  try {
    await ctx.replyWithPhoto(
      { url: `${APP_URL}/icons/icon-512x512.png` },
      {
        caption:
          `👋 *Welcome to Xendrx, ${firstName}!*\n\n` +
          `🔄 The fast & secure P2P crypto exchange.\n\n` +
          `*What you can do:*\n` +
          `• 💱 Buy & Sell USDT instantly\n` +
          `• 🔒 Secure escrow protection\n` +
          `• 📊 Real-time order tracking\n` +
          `• 💬 Built-in trader chat\n` +
          `• 🔔 Instant notifications\n\n` +
          `Tap the button below to open the app and start trading! 🚀`,
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.webApp("🚀 Open Xendrx", APP_URL)]
        ])
      }
    );
  } catch {
    await ctx.reply(
      `👋 Welcome to Xendrx, ${firstName}!\n\nTap below to open the app:`,
      Markup.inlineKeyboard([[Markup.button.webApp("🚀 Open Xendrx", APP_URL)]])
    );
  }
});

bot.on("message", async (ctx) => {
  await ctx.reply(
    "👇 Tap below to open Xendrx:",
    Markup.inlineKeyboard([[Markup.button.webApp("🚀 Open Xendrx", APP_URL)]])
  );
});

export async function sendTelegramMessage(
  telegramId: string,
  text: string,
  url?: string
): Promise<void> {
  if (!TOKEN || !telegramId) return;
  try {
    const keyboard = url
      ? Markup.inlineKeyboard([[Markup.button.webApp("👁 View", url)]])
      : Markup.inlineKeyboard([[Markup.button.webApp("🚀 Open Xendrx", APP_URL)]]);
    await bot.telegram.sendMessage(telegramId, text, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error: any) {
    if (error?.code === 403 || error?.code === 400) {
      console.log(`Cannot send to ${telegramId}:`, error.description);
    } else {
      console.error("Bot message error:", error);
    }
  }
}

export async function startBot(): Promise<void> {
  if (!TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }
  try {
    await bot.telegram.setMyCommands([
      { command: "start", description: "Open Xendrx" },
    ]);
    bot.launch();
    console.log(`✅ @${BOT_USERNAME} started successfully`);
  } catch (error) {
    console.error("Bot launch error:", error);
  }
}

export function stopBot(): void {
  bot.stop("SIGTERM");
}
