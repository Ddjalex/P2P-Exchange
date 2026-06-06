---
name: Push + Telegram notifications
description: Architecture of the PWA push and Telegram bot notification systems added to Xendrx
---

## ⚠️ esbuild + grammy: must be externalized
grammy dynamically loads `./platform.node` at runtime (CJS). esbuild cannot bundle it.
**Fix:** add `"grammy"` to the `external` array in `artifacts/api-server/build.mjs`.
telegraf@4.x also broken on Node.js 24 (node-fetch@2 AbortSignal conflict) — use grammy instead.
Bot API calls use `grammy`'s `InlineKeyboard` and `bot.api.sendMessage()`.
`bot.start()` must NOT be awaited — it blocks until bot stops; call `.catch(console.error)` on it.

## PWA Push Notifications
- `artifacts/p2p-exchange/public/sw.js` — service worker with push handler + notification click handler
- `artifacts/p2p-exchange/src/pwa.ts` — `registerServiceWorker()`, `requestNotificationPermission()`, `subscribeToPush(userId)`
- `artifacts/p2p-exchange/src/components/notification-permission.tsx` — banner shown 10s after page load if permission is 'default'
- `artifacts/p2p-exchange/src/hooks/use-badges.ts` — sets `navigator.setAppBadge(count)` from notif+chat+order counts
- `artifacts/api-server/src/routes/push.ts` — POST /api/push/subscribe, DELETE /api/push/unsubscribe, GET /api/push/vapid-public-key; also exports `PushNotify` object
- DB table: `push_subscriptions` (userId, endpoint unique, subscription JSON as text)

**Why:** VAPID keys are required. If VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_EMAIL not set, push is silently disabled.

**How to apply:** Generate VAPID keys with `npx web-push generate-vapid-keys`, set as env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, VITE_VAPID_PUBLIC_KEY (frontend).

## Telegram Bot
- `artifacts/api-server/src/telegram/bot.ts` — Telegraf bot; `startBot()` called from index.ts; no-op if TELEGRAM_BOT_TOKEN not set
- `artifacts/api-server/src/telegram/notify.ts` — exports `TelegramNotify` with newOrder, paymentSent, orderCompleted, orderCancelled, appealRaised, newMessage, kycApproved, kycRejected, withdrawalApproved, withdrawalRejected, appealResolved
- DB table: `telegram_users` (userId unique, telegramId unique, telegramUsername, telegramFirstName, linkedAt)
- Profile routes: POST /api/profile/link-telegram, DELETE /api/profile/unlink-telegram, GET /api/profile/telegram-status
- Frontend hook: `src/hooks/use-telegram.ts` — exposes `isTelegram`, `haptic()`, `hapticSuccess()`, `hapticError()`
- Telegram SDK loaded in `index.html` via `<script src="https://telegram.org/js/telegram-web-app.js">`

**Why:** Bot token is required. If TELEGRAM_BOT_TOKEN not set, bot gracefully skips launch.

**How to apply:** Required env vars: TELEGRAM_BOT_TOKEN, APP_URL (public URL of app), TELEGRAM_BOT_USERNAME (defaults to "XendrxBot").

## Where calls are added (fire-and-forget pattern)
Both PushNotify and TelegramNotify calls use `.catch(console.error)` and are added AFTER existing `notify()` calls:
- `orders.ts`: newOrder, paymentSent, orderCompleted, orderCancelled, appealRaised
- `messages.ts`: newMessage (text only; image route has no push yet)
- `admin.ts`: kycApproved/kycRejected (KYC review), withdrawalApproved/withdrawalRejected (approve/reject handlers), appealResolved (dispute resolve — Telegram only)
