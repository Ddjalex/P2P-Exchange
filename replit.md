# XenDRX — P2P Crypto Exchange

A full-stack peer-to-peer USDT (BEP20/BSC) exchange platform with an admin dashboard, Telegram bot integration, KYC verification, and PWA push notifications.

## Stack

- **Frontend** (`artifacts/p2p-exchange`): React + Vite + Tailwind CSS
- **Backend** (`artifacts/api-server`): Node.js + Express, built with esbuild
- **Database**: Neon PostgreSQL (via Drizzle ORM) — no local database; `NEON_DATABASE_URL` is the sole DB backend
- **Blockchain**: BEP20/BSC — per-user HD deposit addresses (BIP-44), hot-wallet sweeps
- **Auth**: JWT for users (`jsonwebtoken`), HMAC-based JWT for admin
- **Notifications**: Web Push (VAPID) + Telegram bot (`telegraf`)

## How to run

The run button starts both services in parallel:
- `artifacts/api-server: API Server` — Express API on port 8080 (build via esbuild, then `node dist/index.mjs`)
- `artifacts/p2p-exchange: web` — Vite dev server on a dynamic port, proxies `/api` to port 8080

To install dependencies after pulling new changes:
```
pnpm install
```

## Required secrets

| Secret | Description |
|---|---|
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string (e.g. `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`) |
| `BSC_HOT_WALLET_PRIVATE_KEY` | 64-char hex BSC private key — signs withdrawals and derives per-user HD deposit addresses |
| `TELEGRAM_BOT_TOKEN` | From @BotFather on Telegram |
| `VAPID_PRIVATE_KEY` | VAPID private key for web push notifications |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side secret (bot protection) |

Only `NEON_DATABASE_URL` is required to start the server. The others enable Telegram, push notifications, withdrawals, and bot protection respectively.

## Admin panel

Available at `/admin`. Default credentials are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars (or overridden via the admin UI and stored in the DB).

## User preferences

- Keep the existing monorepo structure under `artifacts/`
- Do not restructure or migrate the stack
