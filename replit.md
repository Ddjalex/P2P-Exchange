# Xendrx

A Binance-style peer-to-peer cryptocurrency exchange — mobile-first dark-themed React web app where users can buy and sell USDT using Ethiopian birr (ETB) via local payment methods.

## Run & Operate

- App runs via two Replit-managed artifact workflows: `artifacts/p2p-exchange: web` (frontend) and `artifacts/api-server: API Server` (backend). Both start automatically; don't recreate the old manual "Start application"/"API Server" workflows.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/p2p-exchange run dev` — run the frontend (port 21832, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run cleanup` — remove seeded demo data from Neon
- Required env: `NEON_DATABASE_URL` — Neon PostgreSQL connection string (stored in Replit Secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + TanStack Query + Lucide icons + Poppins font
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/p2p-exchange/src/` — React frontend (pages, layout, auth context)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, wallet, ads, orders, messages, kyc, etc.)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all endpoints)
- `lib/api-client-react/src/generated/` — Generated React Query hooks & Zod schemas (do not edit by hand)
- `lib/db/src/schema/` — Drizzle ORM table definitions
- `scripts/src/seed.ts` — Database seeder with demo users, ads, and wallets

## Architecture decisions

- **All monetary amounts stored as TEXT** to avoid float precision issues (parseFloat only for arithmetic)
- **ETB exchange rate and deposit addresses** stored in `system_settings` table, configured via Admin → Settings
- **Payment methods stored as JSON text** in ads table (array of bank/wallet names), not FK relations
- **Database is Neon** — `NEON_DATABASE_URL` is required and stored in Replit Secrets; falls back to `DATABASE_URL` if unset
- **Legacy columns/tables preserved** — the Neon DB predates some schema changes and still has extra columns (`users.name/role/balance/age/sex/avatar_url/referral_code/referred_by`, `orders.customer_name/phone/goal/fiat`) and tables (`fcm_tokens`, `app_config`, `languages`, `password_resets`) not used by current app code. They're declared in `lib/db/src/schema/legacy_*.ts` solely so `drizzle-kit push` doesn't try to drop them — don't remove unless the user explicitly asks to delete that data.
- **API routes mounted under `/api/`** via the global proxy; frontend uses relative URLs

## Product

- **Wallet** — USDT balance, ETB equivalent, deposit address (TRC20/ERC20), withdraw
- **P2P Marketplace** — Buy/Sell ads with filters by amount and payment method
- **Ad Management** — Post, toggle online/offline, delete ads with a 3-step wizard
- **Order Flow** — Create orders, mark payment sent, release USDT, cancel with reason
- **Chat** — Per-order chat thread with system messages
- **Profile** — Trade stats, verification badges, payment methods, feedback
- **KYC** — 3-step identity flow: personal info → document upload → liveness check
- **Admin Panel** — Review and approve/reject KYC submissions

## User preferences

- Dark theme: `#1a1a2e` background, `#00d4ff` neon cyan accent
- Mobile-first (max-width 480px centered on desktop)
- Poppins font
- Binance P2P as design reference

## Gotchas

- Do NOT import `zod/v4` in API server route files — esbuild cannot resolve it. Use plain JS validation or import from `zod` directly
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes before editing frontend hooks
- The `desc` import from drizzle-orm was causing an unused-variable build warning in wallet.ts
- Legacy DB has extra columns on `push_subscriptions` (p256dh/auth/user_agent/last_used_at) and a `pending_registrations` table not used by current app code; declared in schema (push_subscriptions.ts / legacy_pending_registrations.ts) solely so `drizzle-kit push` doesn't try to drop them

## Setup status (re-import)

- Connected to the user's own Neon database via `NEON_DATABASE_URL` secret; schema pushed successfully
- Not configured (optional features will be degraded/disabled until set): `BSC_HOT_WALLET_PRIVATE_KEY` (real withdrawals & new deposit-address derivation), `VAPID_PRIVATE_KEY` (push notifications), `TURNSTILE_SECRET_KEY` (bot-protection verification — bypassed outside production), `TELEGRAM_GATEWAY_TOKEN`, `STROWALLET_PUBLIC_KEY`/`STROWALLET_SECRET_KEY` (card issuing), `GOOGLE_CLIENT_ID` (Google sign-in). Telegram bot itself is running using a token already stored in `system_settings`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/index.ts`
