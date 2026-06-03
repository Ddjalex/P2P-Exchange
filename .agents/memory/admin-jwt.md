---
name: Admin JWT auth
description: Admin authentication uses Node.js built-in crypto HMAC — no external JWT package needed or used
---

## Rule
Admin JWT uses `createHmac('sha256', secret).update(base64url_payload).digest('base64url')`. Token format: `base64url(JSON.stringify(payload)).signature`. Secret from `ADMIN_JWT_SECRET` env var.

**Why:** esbuild (the API server bundler) had issues with some ESM packages like jsonwebtoken; using Node.js built-ins avoids all ESM/CJS bundling complications.

**How to apply:** When modifying admin auth, do not introduce jsonwebtoken or jose — use the `sign()`/`verify()` helpers already in `admin.ts`. Token expiry is 24 hours.
