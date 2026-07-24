---
name: BSC RPC eth_getLogs limits
description: Verified public BSC provider behavior for deposit-monitor log queries
---

Binance's public `bsc-dataseed*.binance.org` endpoints currently reject `eth_getLogs` with `-32005 limit exceeded`, even for a one-block USDT Transfer query, so they should be used for block-number reads only. The no-key Nodies endpoint accepted the monitor's multi-address filter at 150 blocks, while 500/1000 blocks exceeded its plan limit; 250 blocks was intermittently slow.

**Why:** A larger range cannot be safely inferred from Binance's reputation or node ownership when the public RPC method is unavailable.

**How to apply:** Keep the verified 150-block monitor range on Nodies and retain smaller provider-specific fallback chunks. Re-test endpoint limits before increasing the range, because public-provider behavior and rate limits can change.

The deposit monitor's block checkpoint is persisted in `system_settings` under `bscDepositLastProcessedBlock`. It is written only after a complete scan chunk, including all deposit handling, succeeds; an RPC or crediting failure leaves the previous checkpoint for retry.

**Why:** An in-memory cursor plus a fixed startup lookback can permanently miss deposits during downtime, and advancing the cursor before crediting can lose events after a per-event failure.

**How to apply:** Treat the database checkpoint as the resume cursor. A missing row means first-ever-run lookback; do not replace the persisted value with a moving tip-based lookback during retries.