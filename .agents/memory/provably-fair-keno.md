---
name: GLI-11 Provably Fair Keno
description: 3-step commitment scheme for Keno draw fairness; covers backend engine, round lifecycle, and frontend UI
---

# GLI-11 Provably Fair Keno

## The rule
Every draw must be commit-then-reveal: publish a cryptographic commitment before any bet is placed, lock in the draw at draw time using deterministic HMAC-SHA256 Fisher-Yates, then expose the seed so players can verify.

**Why:** Satisfies GLI-11 §6.1 — entropy source must be OS CSPRNG, draw must be independently reproducible by any party.

## How to apply

### Payout source of truth
All settlement paths must read the configured `keno_paytable` rows, including shared multiplayer rounds. Do not use a partial hardcoded payout map for runtime evaluation; it can silently make higher pick counts (5–10) settle as zero.

**Why:** The database paytable supports every pick/hit combination through 10 picks and can be changed by admins; a legacy in-memory map only covered a subset and caused valid wins to disappear.

**How to apply:** When adding or changing a Keno settlement path, use the persisted paytable for `(picks, hits)` and expose the resulting payout in the round result consumed by the frontend.

### Backend (`artifacts/api-server/src/routes/keno.ts`)

Three functions at the top of the keno draw section:
- `generateServerSeed()` → `randomBytes(32).toString('hex')` — called at round creation
- `computeServerHash(seed, roundId, seedTimestamp)` → `SHA-256("seed|roundId|ts")` — published to clients pre-betting
- `deriveProvablyFairDraw(seed, roundId, drawTimestamp)` → HMAC-SHA256 Fisher-Yates over pool 1–80, return sorted top 20

All three imports come from Node.js `crypto` (already imported: `randomBytes`, `createHash`, `createHmac`).

`GameRound` carries: `serverSeed`, `serverHash`, `seedTimestamp`, `drawTimestamp|null`, `serverSeedRevealed|null`.

Lifecycle:
1. `makeRound()` — generates seed + hash + seedTimestamp; `serverSeedRevealed = null`
2. `advanceRound()` — records `drawTimestamp = Date.now()`, calls `deriveProvablyFairDraw()`, sets `serverSeedRevealed = serverSeed`
3. `/state` response — always sends `serverHash` + `seedTimestamp`; sends `serverSeedRevealed` + `drawTimestamp` only after draw

Instant play (`/play`, `/play-batch`) — each gets its own ephemeral seed; `roundId=0` for the HMAC; full seed revealed in the response immediately.

### Frontend (`artifacts/p2p-exchange/src/pages/keno.tsx`)

`roundState` type includes: `serverHash`, `seedTimestamp`, `serverSeedRevealed`, `drawTimestamp`, `status`.

UI badges injected above the ball-tray area:
- **Betting phase** — cyan "COMMITTED" badge showing truncated `serverHash`
- **Drawing phase** — purple "Seed Revealed" panel showing full seed + verification formula

### Animation timing

The shared round keeps the settled ticket and result visible for `DRAWING_MS = 8000`.
The client reveals 20 balls at 180 ms active + 80 ms gap, then leaves the final
numbers/result visible until the next betting round starts.

### CSS (`artifacts/p2p-exchange/src/index.css`)

`keno-cell-flash` animation: 0.14 s (was 0.55 s) to match the tighter rhythm.  
`keno-ball-burst` keyframe: radial ring that scales 0.8 → 2.6 and fades — applied via `.keno-cell-flash::after`.  
`keno-ball-drop`: 0.13 s (was 0.45 s).

## Verification formula (document to users)
```
SHA-256( serverSeedRevealed + "|" + roundId + "|" + seedTimestamp ) === serverHash
```
Then reproduce the draw:
```
for i in 79..1:
  h = HMAC-SHA256(key=serverSeed, data=`${roundId}:${drawTimestamp}:${i}`)
  j = h.readUInt32BE(0) % (i + 1)
  swap pool[i], pool[j]
first 20 of pool, sorted ascending
```
