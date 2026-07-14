import { Bot, InlineKeyboard } from "grammy";
import { db, telegramLinkCodesTable, telegramUsersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { emitToUser } from "../lib/sse.js";

const APP_URL = process.env.APP_URL ?? "";

let bot: Bot | null = null;
let activeToken: string = process.env.TELEGRAM_BOT_TOKEN ?? "";
let activeBotUsername: string = process.env.TELEGRAM_BOT_USERNAME ?? "XendrxBot";

function buildBot(token: string): Bot {
  const b = new Bot(token);

  // Prevent individual update errors (e.g. user blocked bot, 403) from
  // crashing the polling loop. Without this handler grammy re-throws and
  // bot.start() rejects, setting bot = null and showing "⚪ Inactive".
  b.catch((err) => {
    const code = (err.error as any)?.error_code;
    if (code === 403 || code === 400) {
      // User blocked the bot or bad request — not fatal, just log quietly.
      console.log(`[Bot] Ignored update error (${code}):`, (err.error as any)?.description ?? err.message);
    } else {
      console.error("[Bot] Update error:", err);
    }
  });

  b.command("start", async (ctx) => {
    const firstName = ctx.from?.first_name ?? "Trader";
    const code = ctx.message.text.split(" ")[1]?.toUpperCase();

    // ── Account linking flow ───────────────────────────────────────────────────
    if (code) {
      try {
        const now = new Date();
        const rows = await db.select().from(telegramLinkCodesTable)
          .where(and(eq(telegramLinkCodesTable.code, code), gt(telegramLinkCodesTable.expiresAt, now)))
          .limit(1);

        if (!rows[0]) {
          await ctx.reply("❌ Invalid or expired code. Please get a new code from the Xendrx website.");
          return;
        }

        const { userId } = rows[0];

        await db.insert(telegramUsersTable).values({
          userId,
          telegramId: String(ctx.from!.id),
          telegramUsername: ctx.from?.username ?? null,
          telegramFirstName: ctx.from?.first_name ?? null,
        }).onConflictDoUpdate({
          target: telegramUsersTable.userId,
          set: {
            telegramId: String(ctx.from!.id),
            telegramUsername: ctx.from?.username ?? null,
            linkedAt: now,
          },
        });

        await db.delete(telegramLinkCodesTable).where(eq(telegramLinkCodesTable.userId, userId));

        emitToUser(userId, "telegram_linked", { telegramId: String(ctx.from!.id) });

        await ctx.reply("✅ Your Telegram account has been successfully linked to Xendrx!\n\nYou'll now receive instant notifications for your trades.");
        return;
      } catch (err) {
        console.error("[Bot] Link code error:", err);
        await ctx.reply("❌ Something went wrong. Please try again.");
        return;
      }
    }

    // ── Default welcome ────────────────────────────────────────────────────────
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
    const text = (ctx.message as any).text?.trim() ?? "";
    // Handle plain code messages (user typed code directly instead of using deep link)
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      const code = text.toUpperCase();
      try {
        const now = new Date();
        const rows = await db.select().from(telegramLinkCodesTable)
          .where(and(eq(telegramLinkCodesTable.code, code), gt(telegramLinkCodesTable.expiresAt, now)))
          .limit(1);

        if (rows[0]) {
          const { userId } = rows[0];
          await db.insert(telegramUsersTable).values({
            userId,
            telegramId: String(ctx.from!.id),
            telegramUsername: ctx.from?.username ?? null,
            telegramFirstName: ctx.from?.first_name ?? null,
          }).onConflictDoUpdate({
            target: telegramUsersTable.userId,
            set: {
              telegramId: String(ctx.from!.id),
              telegramUsername: ctx.from?.username ?? null,
              linkedAt: now,
            },
          });
          await db.delete(telegramLinkCodesTable).where(eq(telegramLinkCodesTable.userId, userId));
          emitToUser(userId, "telegram_linked", { telegramId: String(ctx.from!.id) });
          await ctx.reply("✅ Your Telegram account has been successfully linked to Xendrx!\n\nYou'll now receive instant notifications for your trades.");
          return;
        }
      } catch (err) {
        console.error("[Bot] Plain code link error:", err);
      }
    }

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
