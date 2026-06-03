---
name: User auth system
description: JWT login/register/me implementation details and key gotchas
---

# User Auth System

## How it works
- `bcryptjs` + `jsonwebtoken` installed in api-server (NOT the admin HMAC pattern)
- JWT signed with `process.env.JWT_SECRET` (fallback dev secret if unset)
- Token stored in browser `localStorage` key `p2p_token`
- `setAuthTokenGetter(() => localStorage.getItem("p2p_token"))` called in AuthProvider's useEffect — injects Bearer header on every generated API hook call
- `GET /api/auth/me` requires `Authorization: Bearer <token>` — returns 401 if missing/invalid (no dev bypass)
- `POST /api/auth/register` creates user + wallet row atomically
- `POST /api/auth/login` finds user by phone (suffix match) or email

## Key decisions
- `passwordHash` column added to usersTable as nullable text (backward compat with seed users who have no password)
- Phone users stored with `${dialCode}${identifier}` in phone column; email set to `${identifier}@phone.ethiop2p.com` as placeholder (unique per phone)
- ET phone validation: `^[97]\d{8}$` (9 digits, starts with 9 or 7)
- Non-ET countries: email only (tabs hidden on auth page)
- Auth page is a full React conversion of auth_v2.html with identical CSS animations (sliding panel, toggled class)
- Font Awesome loaded via `<link>` in index.html head — NOT via CSS @import (CDN @import doesn't work reliably in Vite CSS)

**Why:** `setAuthTokenGetter` from `@workspace/api-client-react` (the main index) — not the deep `/src/custom-fetch` subpath which is not exported in package.json

## ProtectedRoute pattern
```tsx
function ProtectedRoute({ component: Component }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  return <Component />;
}
```

## Array.isArray guards
All pages using `useListAds` or similar list hooks must guard: `const ads = Array.isArray(adsRaw) ? adsRaw : []` — API can return non-array during loading/error states.
