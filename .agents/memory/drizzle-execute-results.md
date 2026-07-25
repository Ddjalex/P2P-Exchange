---
name: Drizzle execute results
description: Drizzle node-postgres execute queries return a QueryResult object rather than an iterable row tuple.
---

When using `db.execute()` or `tx.execute()` with Drizzle's node-postgres driver, read selected rows from the returned `.rows` array; do not destructure the result as `[row]`.

**Why:** Destructuring a QueryResult throws `TypeError: (intermediate value) is not iterable` at runtime and can turn an otherwise valid transaction into a generic 500.

**How to apply:** Use `const result = await tx.execute(sql\`SELECT ...\`); const row = result.rows[0];` in balance-transfer and row-locking code.