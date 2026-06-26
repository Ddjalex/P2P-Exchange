---
name: Per-user HD deposit addresses
description: BSC HD derivation for per-user deposit addresses; baseline state before first real deposit test
---

## Rule
`BSC_HOT_WALLET_PRIVATE_KEY` (64-hex) doubles as HD master seed.
Derivation path: `m/44'/60'/0'/0/<userId>` via `@scure/bip32` + `ethers.Wallet`.
Monitor uses topics[2] OR filter so one `eth_getLogs` call covers all users.

**Why:** Avoids sharing a single hot-wallet address across users; each user gets a unique, deterministic, recoverable BEP20 deposit address.

**How to apply:** Any new deposit address endpoint must call `isHdConfigured()` first; if false, fall back to system_settings `bscAddress`. Monitor auto-switches from legacy→per-user as soon as ≥1 wallet row has a valid EVM address.

## Known addresses (derived from master key)
- User 3 (Alex): `0xB4247eaD0ef57e7c86b38ae6ffDeEdfEB0A3Caa3`
- User 4 (Trust): `0x23596F6EDC8DeAc9b3953CbcA57CDB4D4D6160fA`
- User 5 (Ephi): `0xa6e68D84bAae459A47BcCAFd6d9eAb5f90deDcA5`
- User 6: `0x3841Ad6EfC21CEc7cbaE1d734cF3631641dEB54a`
- User 7 (Nati): `0x55922934608E1b07A46D33d34876E3780B48E181`
- Hot wallet: `0x24c3AaC7A62a37333885Bc9a8A82ca4fDe7321B3`

## Live deposit test baseline (2026-06-26)
- **Tester**: User 4 (Trust ✔️), deposit address `0x23596F6EDC8DeAc9b3953CbcA57CDB4D4D6160fA`
- **Hot wallet before**: 1.99 USDT, 0 BNB (MetaMask Account 2, `0x24c3A…321B3`)
- **Platform balance before**: 1,208.95 USDT (UID: 563640796)
- **Source**: Binance withdrawal → user's unique HD address
- **Expected result**: balance → 1,208.95 + deposit_amount; sweep USDT to hot wallet

## RPC endpoints (eth_getLogs)
Use `BSC_GETLOGS_ENDPOINTS` in deposit-monitor.ts:
1. `https://bsc-pokt.nodies.app` (primary — reliable, 250 block limit)
2. `https://rpc.ankr.com/bsc` (fallback)
3. `https://bsc.publicnode.com` (fallback)
`1rpc.io/bnb` was removed — hits free plan rate limit quickly.

## Sweep logic
After crediting, `sweepUsdtToHotWallet()`:
1. Checks BNB balance on derived address — if < 0.001 BNB, tops up 0.002 BNB from hot wallet
2. Sweeps all USDT to `BSC_HOT_WALLET_ADDRESS`
3. Fire-and-forget — never reverses the credit on failure
