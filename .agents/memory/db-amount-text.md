---
name: Amount fields stored as text
description: All monetary amount columns in the DB are text type — SQL aggregate functions need explicit casting
---

## Rule
All monetary fields (`amount`, `availableBalance`, `frozenBalance`, `price`, `totalAmount`, etc.) are stored as `text` in PostgreSQL. Standard SQL aggregate functions like `sum()` fail with "function sum(text) does not exist".

**Why:** The schema was designed with text columns for precision/flexibility, not numeric.

**How to apply:** Always cast before aggregating: `sql\`sum(${field}::numeric)\`` or `sql\`avg(${field}::numeric)\``. Do NOT use drizzle's `sum()` import directly on text columns.
