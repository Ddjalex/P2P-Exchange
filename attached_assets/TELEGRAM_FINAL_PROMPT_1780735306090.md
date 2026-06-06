# Xendrx — Telegram Mini App Final
# Bot welcome → Open button → Website inside Telegram → Normal login → Full app
# Paste this into Replit AI

---

## EXACT FLOW
1. User opens @XendrxBot on Telegram
2. Bot sends welcome message with app preview image
3. Shows [🚀 Open Xendrx] button
4. User taps button
5. Website opens INSIDE Telegram (full screen)
6. Shows normal Login/Register page (same as website)
7. User enters email/phone + password normally
8. After login → wallet, P2P, orders, chat — everything same as website
9. When orders/messages arrive → bot sends notification message

---

## IMPORTANT RULES
- Do NOT change any existing pages
- Do NOT change existing login/register
- Do NOT auto-login with Telegram identity
- Website inside Telegram = same as opening xendrx.com in browser
- Only ADD: bot welcome + notification messages
- All changes are ADDITIVE only

---

## STEP 1 — BotFather Setup (do manually before coding)

```
1. Open Telegram → search @BotFather
2. Send: /newbot
3. Name: Xendrx
4. Username: XendrxBot
5. Copy the TOKEN → add to .env

6. /setdescription → "Fast & secure P2P crypto exchange"
7. /setabouttext → "Buy and sell USDT instantly. Swap · Trade · Grow"
8. /setuserpic → upload your Xendrx logo icon

9. /newapp or /setmenubutton:
   Button text: 🚀 Open Xendrx
   URL: https://your-replit-app.replit.app

10. /setdomain → your-replit-app.replit.app
```

Add to `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_BOT_USERNAME=XendrxBot
APP_URL=https://your-replit-app.replit.app
```

---

## STEP 2 — Install Package

```bash
pnpm --filter @workspace/api-server add telegraf
```

---

## STEP 3 — Create Bot File

Create `artifacts/api-server/src/telegram/bot.ts`:

```typescript
import { Telegraf, Markup } from 'telegraf';
import { db } from '../db';
import { telegramUsers, users, wallets, orders } from '../schema';
import { eq, or, inArray } from 'drizzle-orm';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'XendrxBot';

export const bot = new Telegraf(TOKEN);

// ── /start command ──
bot.command('start', async (ctx) => {
  const firstName = ctx.from?.first_name || 'Trader';

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
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Open Xendrx', APP_URL)]
      ])
    }
  );
});

// ── Any other message → show open button ──
bot.on('message', async (ctx) => {
  await ctx.reply(
    '👇 Tap below to open Xendrx:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Open Xendrx', APP_URL)]
    ])
  );
});

// ── Send notification to user ──
export async function sendTelegramMessage(
  telegramId: string,
  text: string,
  url?: string
) {
  if (!TOKEN || !telegramId) return;

  try {
    const keyboard = url
      ? Markup.inlineKeyboard([[
          Markup.button.webApp('👁 View', url)
        ]])
      : Markup.inlineKeyboard([[
          Markup.button.webApp('🚀 Open Xendrx', APP_URL)
        ]]);

    await bot.telegram.sendMessage(telegramId, text, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error: any) {
    // User blocked bot or chat not found — ignore
    if (error.code === 403 || error.code === 400) {
      console.log(`Cannot send to ${telegramId}:`, error.description);
    } else {
      console.error('Bot message error:', error);
    }
  }
}

// ── Start bot ──
export async function startBot() {
  if (!TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  try {
    // Set bot commands
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Open Xendrx' }
    ]);

    await bot.launch();
    console.log(`✅ @${BOT_USERNAME} started successfully`);
  } catch (error) {
    console.error('Bot launch error:', error);
  }
}

export function stopBot() {
  bot.stop('SIGTERM');
}
```

---

## STEP 4 — Database: Telegram Users Table

Add to schema and run migration:

```sql
CREATE TABLE IF NOT EXISTS telegram_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  telegram_id VARCHAR(50) UNIQUE NOT NULL,
  telegram_username VARCHAR(100),
  telegram_first_name VARCHAR(100),
  linked_at TIMESTAMP DEFAULT NOW()
);
```

---

## STEP 5 — Telegram Notification Helper

Create `artifacts/api-server/src/telegram/notify.ts`:

```typescript
import { sendTelegramMessage } from './bot';
import { db } from '../db';
import { telegramUsers } from '../schema';
import { eq } from 'drizzle-orm';

const APP_URL = process.env.APP_URL || '';

// Get telegram ID for a user
async function getTgId(userId: number): Promise<string | null> {
  try {
    const tg = await db.query.telegramUsers.findFirst({
      where: eq(telegramUsers.userId, userId)
    });
    return tg?.telegramId || null;
  } catch {
    return null;
  }
}

export const TelegramNotify = {

  // New order created → notify seller
  async newOrder(sellerId: number, orderId: number, usdt: string, etb: string) {
    const tgId = await getTgId(sellerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `🔔 *New Order Received!*\n\n` +
      `Amount: \`${usdt} USDT\`\n` +
      `ETB: \`Br ${etb}\`\n\n` +
      `⚡ Respond quickly to maintain your rating!`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  // Buyer marked paid → notify seller
  async paymentSent(sellerId: number, orderId: number, etb: string) {
    const tgId = await getTgId(sellerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `💰 *Buyer Marked Payment Sent!*\n\n` +
      `Amount: \`Br ${etb}\`\n\n` +
      `✅ Please verify payment in your account then release crypto.`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  // Seller released → notify buyer
  async orderCompleted(buyerId: number, orderId: number, usdt: string) {
    const tgId = await getTgId(buyerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `🎉 *Order Completed!*\n\n` +
      `\`${usdt} USDT\` has been deposited to your wallet!\n\n` +
      `Thank you for trading on Xendrx 🚀`,
      `${APP_URL}/wallet`
    );
  },

  // Order cancelled
  async orderCancelled(userId: number, orderId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *Order Cancelled*\n\n` +
      `Your order has been cancelled.\n` +
      `Contact support@xendrx.com if you need help.`,
      `${APP_URL}/orders`
    );
  },

  // Appeal raised
  async appealRaised(userId: number, orderId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `⚠️ *Appeal Raised*\n\n` +
      `An appeal has been filed on your order.\n` +
      `Admin will review and resolve within 24 hours.\n` +
      `Your funds are safe in Xendrx escrow.`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  // New chat message
  async newMessage(userId: number, orderId: number, sender: string, preview: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `💬 *New Message from ${sender}*\n\n` +
      `"${preview.slice(0, 80)}${preview.length > 80 ? '...' : ''}"`,
      `${APP_URL}/chat/${orderId}`
    );
  },

  // KYC approved
  async kycApproved(userId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `✅ *Identity Verified!*\n\n` +
      `Your KYC has been approved!\n` +
      `You can now trade on Xendrx 🚀`,
      `${APP_URL}/p2p`
    );
  },

  // KYC rejected
  async kycRejected(userId: number, reason: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *KYC Rejected*\n\n` +
      `Reason: ${reason}\n\n` +
      `Please resubmit with correct documents.`,
      `${APP_URL}/kyc`
    );
  },

  // Withdrawal approved
  async withdrawalApproved(userId: number, amount: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `✅ *Withdrawal Approved*\n\n` +
      `\`${amount} USDT\` withdrawal is being processed.\n` +
      `Funds will arrive within 30 minutes.`,
      `${APP_URL}/wallet`
    );
  },

  // Withdrawal rejected
  async withdrawalRejected(userId: number, amount: string, reason: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *Withdrawal Rejected*\n\n` +
      `Amount: \`${amount} USDT\`\n` +
      `Reason: ${reason}\n\n` +
      `Funds returned to your wallet.`,
      `${APP_URL}/wallet`
    );
  },

  // Appeal resolved
  async appealResolved(userId: number, orderId: number, won: boolean) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      won
        ? `✅ *Appeal Resolved — You Won!*\n\nFunds have been released to your wallet.`
        : `❌ *Appeal Resolved*\n\nThe appeal was decided in favor of the counterparty.`,
      `${APP_URL}/orders`
    );
  }
};
```

---

## STEP 6 — Add Telegram Notify to ALL Events

In every route file, add AFTER existing notification code.
DO NOT remove existing code — just add:

```typescript
import { TelegramNotify } from '../telegram/notify';

// In POST /api/orders (after order created):
TelegramNotify.newOrder(
  order.sellerId,
  order.id,
  Number(order.amountUsdt).toFixed(4),
  Number(order.amountEtb).toLocaleString()
).catch(console.error);

// In PATCH /api/orders/:id/mark-paid:
TelegramNotify.paymentSent(
  order.sellerId,
  order.id,
  Number(order.amountEtb).toLocaleString()
).catch(console.error);

// In PATCH /api/orders/:id/release:
TelegramNotify.orderCompleted(
  order.buyerId,
  order.id,
  Number(order.amountUsdt).toFixed(4)
).catch(console.error);

// In PATCH /api/orders/:id/cancel:
TelegramNotify.orderCancelled(counterpartyId, order.id).catch(console.error);

// In POST /api/orders/:id/appeal:
TelegramNotify.appealRaised(counterpartyId, order.id).catch(console.error);

// In POST /api/orders/:id/messages:
TelegramNotify.newMessage(
  receiverId,
  orderId,
  req.user.username,
  content
).catch(console.error);

// In admin KYC approve:
TelegramNotify.kycApproved(submission.userId).catch(console.error);

// In admin KYC reject:
TelegramNotify.kycRejected(submission.userId, reason).catch(console.error);

// In admin withdrawal approve:
TelegramNotify.withdrawalApproved(userId, amount).catch(console.error);

// In admin withdrawal reject:
TelegramNotify.withdrawalRejected(userId, amount, reason).catch(console.error);

// In admin dispute resolve:
TelegramNotify.appealResolved(buyerId, orderId, buyerWins).catch(console.error);
TelegramNotify.appealResolved(sellerId, orderId, !buyerWins).catch(console.error);
```

---

## STEP 7 — Link Telegram in Profile

Add route to link Telegram account:

```typescript
// POST /api/profile/link-telegram
app.post('/api/profile/link-telegram', authenticate, async (req, res) => {
  try {
    const { telegramId, telegramUsername, telegramFirstName } = req.body;

    if (!telegramId) {
      return res.status(400).json({ message: 'Telegram ID required' });
    }

    // Check not already taken by another user
    const existing = await db.query.telegramUsers.findFirst({
      where: eq(telegramUsers.telegramId, telegramId.toString())
    });

    if (existing && existing.userId !== req.user.id) {
      return res.status(400).json({
        message: 'This Telegram account is already linked to another user'
      });
    }

    await db.insert(telegramUsers).values({
      userId: req.user.id,
      telegramId: telegramId.toString(),
      telegramUsername: telegramUsername || null,
      telegramFirstName: telegramFirstName || null,
      linkedAt: new Date()
    }).onConflictDoUpdate({
      target: telegramUsers.userId,
      set: {
        telegramId: telegramId.toString(),
        telegramUsername: telegramUsername || null,
        linkedAt: new Date()
      }
    });

    return res.json({ success: true, message: 'Telegram linked successfully!' });
  } catch (error) {
    console.error('Link telegram error:', error);
    return res.status(500).json({ message: 'Failed to link Telegram' });
  }
});

// DELETE /api/profile/unlink-telegram
app.delete('/api/profile/unlink-telegram', authenticate, async (req, res) => {
  try {
    await db.delete(telegramUsers)
      .where(eq(telegramUsers.userId, req.user.id));
    return res.json({ success: true, message: 'Telegram unlinked' });
  } catch {
    return res.status(500).json({ message: 'Failed to unlink' });
  }
});

// GET /api/profile/telegram-status
app.get('/api/profile/telegram-status', authenticate, async (req, res) => {
  try {
    const tg = await db.query.telegramUsers.findFirst({
      where: eq(telegramUsers.userId, req.user.id)
    });
    return res.json({
      linked: !!tg,
      telegramUsername: tg?.telegramUsername || null,
      linkedAt: tg?.linkedAt || null
    });
  } catch {
    return res.json({ linked: false });
  }
});
```

---

## STEP 8 — Add Telegram SDK to index.html

In `artifacts/p2p-exchange/index.html` inside `<head>`:

```html
<!-- Telegram Mini App SDK — loads when inside Telegram only -->
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

---

## STEP 9 — Telegram UI Adjustments (frontend)

Create `src/hooks/use-telegram.ts`:

```typescript
import { useEffect, useState } from 'react';

export function useTelegram() {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();                        // Full screen
      tg.setHeaderColor('#080d18');
      tg.setBackgroundColor('#080d18');
    }
  }, []);

  const haptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
  };

  const hapticSuccess = () => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const hapticError = () => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
  };

  return { isTelegram, haptic, hapticSuccess, hapticError };
}
```

---

## STEP 10 — Apply Haptic Feedback on Key Actions

In key action files, ADD haptic (do not change other logic):

```typescript
import { useTelegram } from '@/hooks/use-telegram';

const { haptic, hapticSuccess, hapticError } = useTelegram();

// When Buy USDT button tapped:
haptic('medium');

// When order created successfully:
hapticSuccess();

// When payment confirmed:
haptic('heavy');

// When order completed:
hapticSuccess();

// When error occurs:
hapticError();

// When any button tapped:
haptic('light');
```

---

## STEP 11 — Link Telegram in Profile Page

In `src/pages/profile.tsx` add "Link Telegram" section:

```tsx
// In Others tab or Trade tab:
const { data: tgStatus } = useQuery({
  queryKey: ['telegram-status'],
  queryFn: () => fetch('/api/profile/telegram-status', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())
});

// UI:
<div style={{
  padding: '14px 0',
  borderBottom: '1px solid #1e2d3d',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  <div>
    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
      🤖 Telegram Notifications
    </div>
    <div style={{ color: '#8899aa', fontSize: '11px', marginTop: '2px' }}>
      {tgStatus?.linked
        ? `Linked: @${tgStatus.telegramUsername || 'connected'}`
        : 'Get order alerts on Telegram'
      }
    </div>
  </div>

  {tgStatus?.linked ? (
    <button
      onClick={handleUnlinkTelegram}
      style={{
        background: 'transparent',
        border: '1px solid #ff4444',
        borderRadius: '16px', padding: '6px 12px',
        color: '#ff4444', fontSize: '11px',
        cursor: 'pointer'
      }}>
      Unlink
    </button>
  ) : (
    <a
      href={`https://t.me/${process.env.VITE_BOT_USERNAME || 'XendrxBot'}?start=link`}
      target="_blank"
      rel="noreferrer"
      style={{
        background: '#2196F3',
        borderRadius: '16px', padding: '6px 14px',
        color: '#fff', fontSize: '11px',
        fontWeight: 600, textDecoration: 'none',
        display: 'inline-block'
      }}>
      Link →
    </a>
  )}
</div>
```

Add to `.env`:
```env
VITE_BOT_USERNAME=XendrxBot
```

---

## STEP 12 — Start Bot in Server

In `artifacts/api-server/src/index.ts` ADD after `app.listen()`:

```typescript
import { startBot, stopBot } from './telegram/bot';

// Start Telegram bot
startBot();

// Graceful shutdown
process.once('SIGINT', () => {
  stopBot();
  process.exit(0);
});
process.once('SIGTERM', () => {
  stopBot();
  process.exit(0);
});
```

---

## COMPLETE FLOW SUMMARY

```
TELEGRAM FLOW:
━━━━━━━━━━━━
1. User opens @XendrxBot
2. Bot sends welcome message with logo image
3. Shows [🚀 Open Xendrx] button
4. User taps → Xendrx website opens INSIDE Telegram
5. Shows normal Login/Register page
6. User enters credentials (email/phone + password)
7. After login → wallet, P2P, orders, chat — ALL SAME AS WEBSITE
8. User trades normally

NOTIFICATION FLOW:
━━━━━━━━━━━━━━━━
When any event happens:
→ Telegram message sent to user's Telegram
→ Message has [👁 View] button
→ Tapping opens that page inside Telegram Mini App

LINK TELEGRAM IN PROFILE:
━━━━━━━━━━━━━━━━━━━━━━━
User goes to Profile → Others → "Link Telegram"
→ Taps link → opens bot → bot links account
→ Now receives Telegram notifications

NORMAL WEBSITE:
━━━━━━━━━━━━━
xendrx.com works exactly the same
No changes to existing login/pages
PWA install works normally
```

---

## VERIFICATION CHECKLIST

- [ ] @XendrxBot responds to /start with welcome image + Open button
- [ ] Tapping Open button opens website inside Telegram
- [ ] Login page shows normally inside Telegram
- [ ] After login all pages work same as website
- [ ] P2P marketplace loads and shows ads
- [ ] Can create orders inside Telegram
- [ ] Chat works inside Telegram
- [ ] New order sends Telegram message to seller
- [ ] Payment marked sends Telegram message to seller
- [ ] Order complete sends Telegram message to buyer
- [ ] KYC approved sends Telegram message
- [ ] Profile shows "Link Telegram" option
- [ ] Normal website login unchanged
- [ ] PWA install unchanged
- [ ] Haptic feedback works on button taps

