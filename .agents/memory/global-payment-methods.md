---
name: Global payment methods
description: How the global (Binance-style) payment methods feature works — 800+ methods, 119 countries, DB schema, API, and frontend
---

## Schema change
- `payment_methods.type` changed from `pgEnum("payment_method_type", [...7 Ethiopian values...])` → plain `text`
- Added `payment_methods.country text NOT NULL DEFAULT 'ET'` (ISO 3166-1 alpha-2)
- Migration: `lib/db/drizzle/0004_global_payment_methods.sql`
- Old enum type `payment_method_type` was dropped from Postgres

## Data file
- `artifacts/api-server/src/data/global-payment-methods.ts` — 119 countries, 800+ methods
- Each method: `{ id, name, fieldType: "bank"|"mobile"|"wallet"|"card", accountLabel, accountPlaceholder, inputType }`
- Helper: `getMethodsForCountry(isoCode)` — falls back to SWIFT/WU/PayPal for unlisted countries
- **Warning:** Ensure country codes are unique in the array — Niger = "NE" (not "NG" which is Nigeria)

## API endpoints (all require auth)
- `GET /api/profile/payment-methods/available?country=XX` — catalogue for a country
- `GET /api/profile/payment-methods/countries` — list of all 119 supported countries
- `POST /api/profile/payment-methods` — now accepts optional `country` field (defaults to user's profile country)
- `GET /api/profile/payment-methods` — now returns `country` field in each result

## Generated client types updated
- `lib/api-client-react/src/generated/api.schemas.ts` — `PaymentMethod.type` is now `string`, `PaymentMethodInput.type` is `string`, `country` added to both; old `PaymentMethodType`/`PaymentMethodInputType` enums removed
- `lib/api-zod/src/generated/api.ts` — zod schemas updated to `zod.string()` for type, `country` added
- `lib/api-spec/openapi.yaml` — enum removed from PaymentMethod/PaymentMethodInput

## Frontend
- `artifacts/p2p-exchange/src/pages/payment-methods.tsx` — full rewrite with country picker, method search, grouped by type
- `artifacts/p2p-exchange/src/constants/payment-countries.ts` — frontend country list (must stay in sync with backend data)
- Uses `localStorage.getItem("p2p_token")` for auth in custom fetch (same pattern as kyc.tsx)
- `useGetMe()` provides `me.country` (ISO-2) for auto-selecting user's country

**Why:** Platform is expanding from Ethiopia-only to global P2P exchange, matching Binance P2P's 800+ payment method support across 119 countries.
