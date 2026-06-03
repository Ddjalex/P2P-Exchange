---
name: Admin dashboard architecture
description: How the admin dashboard is structured — backend routes, frontend pages, auth flow
---

## Rule
- All admin API routes live in `artifacts/api-server/src/routes/admin.ts` under `/api/admin/`
- Admin auth: `POST /api/admin/auth/login` with env vars `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- Frontend auth stored in `localStorage` as `admin_token`; fetch utility in `src/lib/admin-api.ts`
- Auth context: `AdminAuthProvider` + `useAdminAuth()` from `src/hooks/use-admin-auth.tsx`
- Layout: `AdminLayout` + `AdminGuard` from `src/components/admin-layout.tsx`
- 11 admin screens: dashboard, users, user-detail, kyc, ads, orders, order-detail, disputes, dispute-detail, wallet, messages, notifications, settings, fees, logs
- All admin pages use `adminGet/adminPost/adminPut/adminDelete` from `@/lib/admin-api` (direct fetch, NOT React Query hooks)

**Why:** Admin is a separate auth context from the main user auth. JWT is stateless; no admin_sessions table needed.

**How to apply:** When adding admin features, add route to admin.ts backend + new page in src/pages/admin-*.tsx + register route in App.tsx.
