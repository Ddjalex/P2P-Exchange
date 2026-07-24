---
name: BSC RPC eth_getLogs limits
description: Verified public BSC provider behavior for deposit-monitor log queries
---

Binance's public `bsc-dataseed*.binance.org` endpoints currently reject `eth_getLogs` with `-32005 limit exceeded`, even for a one-block USDT Transfer query, so they should be used for block-number reads only. The no-key Nodies endpoint accepted the monitor's multi-address filter at 150 blocks, while 500/1000 blocks exceeded its plan limit; 250 blocks was intermittently slow.

**Why:** A larger range cannot be safely inferred from Binance's reputation or node ownership when the public RPC method is unavailable.

**How to apply:** Keep the verified 150-block monitor range on Nodies and retain smaller provider-specific fallback chunks. Re-test endpoint limits before increasing the range, because public-provider behavior and rate limits can change.