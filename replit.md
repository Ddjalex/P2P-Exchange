# XendrX — P2P USDT Exchange

A full-stack P2P cryptocurrency exchange platform (EthioP2P / XendrX) built with React + Vite (frontend) and Express.js (API), backed by Neon PostgreSQL via Drizzle ORM.

## Architecture

| Layer | Path | Notes |
|-------|------|-------|
| Frontend | `artifacts/p2p-exchange/` | React + Vite + Tailwind + shadcn/ui |
| API Server | `artifacts/api-server/` | Express.js, ESM, built with esbuild |
| DB schema | `lib/db/` | Drizzle ORM, Neon PostgreSQL |
| Shared types | `lib/api-zod/`, `lib/api-client-react/` | Zod schemas + React query hooks |

## How to run

Two workflows must be running:

- **`artifacts/api-server: API Server`** — Express API on port 8080
- **`artifacts/p2p-exchange: web`** — Vite dev server on port 5000 (proxies `/api` → port 8080)

Both start automatically via the **Project** run button.

## Required secrets

| Secret | Purpose |
|--------|---------|
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Signs user auth tokens |
| `ADMIN_JWT_SECRET` | Signs admin auth tokens |
| `ADMIN_PASSWORD` | Admin panel login password |

## Optional secrets (for full functionality)

| Secret | Purpose |
|--------|---------|
| `BSC_HOT_WALLET_PRIVATE_KEY` | BEP20 deposits + withdrawals + HD address derivation |
| `BSC_HOT_WALLET_ADDRESS` | Public address of the hot wallet |
| `TELEGRAM_BOT_TOKEN` | Telegram bot integration |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VITE_VAPID_PUBLIC_KEY` | PWA push notifications |
| `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile bot protection |
| `GOOGLE_CLIENT_ID` | Google Sign-In |

## Database migrations

Migrations live in `lib/db/drizzle/`. To apply new migrations:

```bash
cd lib/db && npx drizzle-kit migrate --config ./drizzle.config.ts
```

To generate a new migration after schema changes:

```bash
pnpm --filter @workspace/db run generate
```

## Admin panel

Navigate to `/admin` — log in with `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

## User preferences
