---
name: Replit artifact routing
description: How Replit routes external proxy traffic in the new artifact-based architecture — critical for fixing 502 errors on dev URLs.
---

# Replit Artifact Proxy Routing

**Rule:** Replit's external proxy routes through the `artifacts/<name>: web` workflow, NOT the legacy "Start application" workflow.

**Why:** In Replit's newer agent-based projects, `configureWorkflow` with `outputType: "webview"` triggers artifact registration. The platform creates auto-named workflows like `artifacts/p2p-exchange: web` (using a different port, e.g. 21832) alongside the original workflow. The proxy uses the artifact workflow's port for external routing.

**Symptom:** `curl https://$REPLIT_DEV_DOMAIN/` returns 502 even though the legacy workflow (e.g. "Start application" on port 5000) is running fine and `curl localhost:5000` returns 200.

**Fix:**
1. Call `configureWorkflow({ name: "Start application", outputType: "webview", waitForPort: 5000, ... })` — this triggers artifact registration if not yet done.
2. Check `refresh_all_logs` or `listWorkflows` for auto-created `artifacts/*: web` workflows.
3. Call `restart_workflow` on the artifact workflow (e.g. `artifacts/p2p-exchange: web`).
4. The artifact workflow may use a different port (e.g. 21832) — that's normal, Replit manages it.

**How to apply:** Any time a pnpm monorepo project shows 502 on the dev URL despite the workflow running, check for unstarted artifact workflows via logs and start the `artifacts/<app>: web` one.
