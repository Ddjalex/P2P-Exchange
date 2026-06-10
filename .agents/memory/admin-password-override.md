---
name: Admin password DB override
description: Admin login uses DB-stored password first, falls back to env var
---

The admin login route (`POST /api/admin/auth/login`) checks:
1. First: `systemSettings` table row with key `"adminPassword"` — this is the DB override
2. Fallback: `process.env.ADMIN_PASSWORD` env var

The `PATCH /api/admin/change-password` endpoint stores the new password under key `"adminPassword"` in `systemSettings`.

**Why:** Allows password changes via the admin UI without needing to redeploy or change env vars. Initial password still comes from env for security on first deploy.

**How to apply:** Any code that checks the admin password must use the same DB-first lookup pattern to stay consistent with what `change-password` stores.
