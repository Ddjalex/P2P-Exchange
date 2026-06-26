---
name: Deposit test baseline (June 26 2026)
description: Snapshot of balances before the owner's live Binance→BSC deposit test
---

## Owner's account (DB user 3, username: Alex, UID displayed: 948965077)

- **Unique deposit address**: `0xB4247eaD0ef57e7c86b38ae6ffDeEdfEB0A3Caa3`  
  (HD path m/44'/60'/0'/0/3, derived from BSC_HOT_WALLET_PRIVATE_KEY)
- **Platform balance before deposit**: 813.24 USDT total  
  (337.681 available, 475.556 frozen)

## Hot wallet (MetaMask Account 2)

- **Address**: `0x24c3AaC7A62a37333885Bc9a8A82ca4fDe7321B3`
- **Balance before deposit**: 1.99 USDT on BNB Chain, 0 BNB

## What to expect after deposit lands

1. Monitor log: `[Deposit] Credited X USDT to user 3`
2. Monitor log: `[Sweep] Sweeping X USDT from 0xB4247… to hot wallet`
3. Platform balance increases by deposited amount
4. Hot wallet USDT increases by deposited amount (minus gas)

**Why:** This is the live end-to-end test of the HD deposit + sweep pipeline.
