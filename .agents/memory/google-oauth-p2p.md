---
name: Google Sign-In (P2P exchange)
description: How Google OAuth was wired without a schema change; origin config lives in Google Cloud Console, not app code.
---

Google Sign-In uses `@react-oauth/google` (frontend, ID-token flow) + `google-auth-library` `OAuth2Client.verifyIdToken` (backend). No `GOOGLE_CLIENT_SECRET` is needed for this flow — only `GOOGLE_CLIENT_ID`.

**Why:** `usersTable.passwordHash` was already nullable, so Google-only accounts (matched/created by verified email) need no new column — avoids the schema-change approval step entirely.

**How to apply:** Frontend fetches the client ID from a public `GET /api/auth/google-config` endpoint instead of baking it into a `VITE_`-prefixed build var — works in any environment without a rebuild. `GOOGLE_CLIENT_ID`/`SECRET` are plain env vars (not truly secret; the ID is public in the OAuth flow), but this project stored them via the secrets flow anyway.

Common false alarm: `[GSI_LOGGER]: The given origin is not allowed for the given client ID` + 403s from Google's script in dev. This is NOT a code bug — the current domain (Replit dev domain, and later the prod domain) must be added to "Authorized JavaScript origins" in Google Cloud Console for that OAuth client. Tell the user to add it themselves; nothing to fix in the repo.
