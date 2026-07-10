---
name: Neon DB has legacy columns/tables drizzle-kit wants to drop
description: How this project's Neon database relates to the current Drizzle schema, and how to push safely without data loss.
---

The user's real Neon database (connected via `NEON_DATABASE_URL`) predates some schema
changes and has extra columns/tables not present in `lib/db/src/schema/`. Pushing the
schema naively (`pnpm --filter @workspace/db run push`) proposes dropping them — the
user chose to keep this data, not delete it.

**How it was resolved:** added `lib/db/src/schema/legacy_*.ts` files (and extra nullable
columns on `usersTable`/`ordersTable`) that mirror the DB's actual legacy shape, purely so
drizzle-kit stops proposing DROP statements. These fields aren't used by app logic.

**Why:** `drizzle-kit push` interactive prompts (e.g. "add X unique constraint, truncate
table?") require a TTY and fail non-interactively in this environment. Never blindly pass
`--force` — it auto-approves data-loss statements including table/column drops. Instead:
verify no real non-null duplicates exist for a proposed unique constraint (safe to add
directly via SQL), and for actual DROP TABLE/COLUMN proposals, add matching legacy schema
definitions rather than deleting real user data.

**How to apply:** Before any future `drizzle-kit push` against this Neon DB, expect it to
be clean (no more prompts) unless new legacy drift is introduced. If a new "data-loss
statements" warning appears, stop and ask the user before proceeding — do not use `--force`.
