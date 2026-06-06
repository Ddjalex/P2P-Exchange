import { Bot, InlineKeyboard } from "grammy";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL = process.env.APP_URL ?? "";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "XendrxBot";

let bot: Bot | null = null;

function createBot(): Bot {
  const b = new Bot(TOKEN);

  b.command("start", async (ctx) => {
    const firstName = ctx.from?.first_name ?? "Trader";
    const keyboard = new InlineKeyboard().webApp("🚀 Open Xendrx", APP_URL || "https://xendrx.replit.app");

    try {
      await ctx.replyWithPhoto(
        { url: `${APP_URL}/icons/icon-512x512.png` },
        {
          caption:
            `👋 <b>Welcome to Xendrx, ${firstName}!</b>\n\n` +
            `🔄 The fast &amp; secure P2P crypto exchange.\n\n` +
            `<b>What you can do:</b>\n` +
            `• 💱 Buy &amp; Sell USDT instantly\n` +
            `• 🔒 Secure escrow protection\n` +
            `• 📊 Real-time order tracking\n` +
            `• 💬 Built-in trader chat\n` +
            `• 🔔 Instant notifications\n\n` +
            `Tap the button below to open the app and start trading! 🚀`,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch {
      await ctx.reply(
        `👋 Welcome to Xendrx, ${firstName}!\n\nTap below to open the app 👇`,
        { reply_markup: keyboard }
      );
    }
  });

  b.on("message", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      "🚀 Open Xendrx",
      APP_URL || "https://xendrx.replit.app"
    );
    await ctx.reply("👇 Tap below to open Xendrx:", { reply_markup: keyboard });
  });

  return b;
}

export async function sendTelegramMessage(
  telegramId: string,
  text: string,
  url?: string
): Promise<void> {
  if (!TOKEN || !telegramId || !bot) return;
  try {
    const targetUrl = url ?? APP_URL ?? "https://xendrx.replit.app";
    const keyboard = new InlineKeyboard().webApp(
      url ? "👁 View" : "🚀 Open Xendrx",
      targetUrl
    );
    await bot.api.sendMessage(telegramId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error: any) {
    if (error?.error_code === 403 || error?.error_code === 400) {
      console.log(`Cannot reach Telegram user ${telegramId}:`, error.description);
    } else {
      console.error("Bot sendMessage error:", error);
    }
  }
}

export async function startBot(): Promise<void> {
  if (!TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }
  try {
    bot = createBot();

    // Set commands list shown in Telegram
    await bot.api.setMyCommands([
      { command: "start", description: "Open Xendrx" },
    ]);

    // Start long-polling in the background (do NOT await — it runs until stopped)
    bot.start({
      onStart: (info) => {
        console.log(`✅ @${info.username} bot running`);
      },
    }).catch((err) => {
      console.error("Bot polling error:", err);
    });
  } catch (error) {
    console.error("Bot launch error:", error);
  }
}

export function stopBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
  }
}
