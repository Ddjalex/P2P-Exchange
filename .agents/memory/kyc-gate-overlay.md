---
name: KycGate overlay z-index strategy
description: How the KycGate component blocks page interactions while keeping the bottom nav clickable
---

The bottom nav in layout.tsx uses `z-50` (Tailwind = z-index 50).

KycGate overlay uses z-index 40 (z-40) — below the nav. This means:
- The transparent overlay at z-40 captures all clicks on page content (which is at z-0)
- The bottom nav at z-50 is above the overlay and stays fully clickable for navigation
- The KYC status banner sits at z-[51] (just above nav, different position so no conflict)
- The KYC action modal uses z-[9999] (above everything)

**Why:** Users should be able to browse pages (navigate via bottom nav) even without KYC, but any interaction with content shows the KYC modal. This UX mirrors Binance P2P's approach.

**How to apply:** When adding fixed overlays that should not block the bottom nav, use z-index < 50. The nav is always at z-50 on this app.
