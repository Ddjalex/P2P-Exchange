import { Bot, InlineKeyboard } from "grammy";

const APP_URL = process.env.APP_URL ?? "";

let bot: Bot | null = null;
let activeToken: string = process.env.TELEGRAM_BOT_TOKEN ?? "";
let activeBotUsername: string = process.env.TELEGRAM_BOT_USERNAME ?? "XendrxBot";

function buildBot(token: string): Bot {
  const b = new Bot(token);

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
    const keyboard = new InlineKeyboard().webApp("🚀 Open Xendrx", APP_URL || "https://xendrx.replit.app");
    await ctx.reply("👇 Tap below to open Xendrx:", { reply_markup: keyboard });
  });

  return b;
}

export async function sendTelegramMessage(
  telegramId: string,
  text: string,
  url?: string
): Promise<void> {
  if (!activeToken || !telegramId || !bot) return;
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

export function getBotStatus(): { running: boolean; username: string | null } {
  return { running: bot !== null, username: bot !== null ? activeBotUsername : null };
}

export async function startBot(token?: string, username?: string): Promise<void> {
  const tok = token ?? activeToken;
  if (!tok) {
    console.log("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }
  try {
    bot = buildBot(tok);
    await bot.api.setMyCommands([{ command: "start", description: "Open Xendrx" }]);
    bot.start({
      onStart: (info) => {
        activeBotUsername = info.username;
        activeToken = tok;
        if (username) activeBotUsername = username;
        console.log(`✅ @${activeBotUsername} bot running`);
      },
    }).catch((err) => {
      console.error("Bot polling error:", err);
      bot = null;
    });
  } catch (error) {
    console.error("Bot launch error:", error);
    bot = null;
  }
}

export async function restartBotWithToken(token: string, username?: string): Promise<{ username: string }> {
  stopBot();
  await new Promise(r => setTimeout(r, 500));

  const b = buildBot(token);
  // Verify token is valid by calling getMe
  const me = await b.api.getMe();
  activeBotUsername = username || me.username || "XendrxBot";
  activeToken = token;

  bot = b;
  await bot.api.setMyCommands([{ command: "start", description: "Open Xendrx" }]);
  bot.start({
    onStart: (info) => {
      console.log(`✅ @${info.username} bot running (restarted)`);
    },
  }).catch((err) => {
    console.error("Bot polling error:", err);
    bot = null;
  });

  return { username: activeBotUsername };
}

export function stopBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
  }
}
