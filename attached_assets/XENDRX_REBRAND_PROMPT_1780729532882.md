# Xendrx — Complete Rebrand Prompt
# Rename everything from SwapBirr/EthioP2P to Xendrx
# Logo: Crystal Diamond Hexagon + Cyan #00e5ff
# Paste this entire file into Replit AI

---

## IMPORTANT RULES
- Replace ALL instances of "SwapBirr" with "Xendrx"
- Replace ALL instances of "swapbirr" with "xendrx"
- Replace ALL instances of "EthioP2P" with "Xendrx"
- Replace ALL instances of "ethiop2p" with "xendrx"
- Do NOT mention any country anywhere in the UI
- Do NOT touch any functionality — rebrand only
- New brand colors: #080d18 dark + #00e5ff cyan + Poppins font
- Domain: xendrx.com
- Support: support@xendrx.com
- Admin: admin@xendrx.com

---

## PART 1 — CREATE LOGO SVG FILES

### `src/assets/logo-icon.svg` (App Icon 512×512)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="40" fill="#080d18"/>
  <rect width="200" height="200" rx="40" fill="none" stroke="#00e5ff" stroke-width="2.5" opacity="0.5"/>
  <!-- Outer hexagon -->
  <polygon points="100,8 168,48 168,128 100,168 32,128 32,48"
    fill="#060c16" stroke="#00e5ff" stroke-width="3"/>
  <!-- Inner hex subtle -->
  <polygon points="100,28 152,58 152,118 100,148 48,118 48,58"
    fill="none" stroke="#00e5ff" stroke-width="1" opacity="0.2"/>
  <!-- Diamond shape -->
  <polygon points="100,36 144,100 100,164 56,100"
    fill="none" stroke="#00e5ff" stroke-width="3"/>
  <!-- Diamond segments -->
  <polygon points="100,36 144,100 100,100" fill="#00e5ff" opacity="0.1"/>
  <polygon points="56,100 100,100 100,164" fill="#00e5ff" opacity="0.07"/>
  <polygon points="100,36 100,100 56,100" fill="#00e5ff" opacity="0.05"/>
  <polygon points="144,100 100,164 100,100" fill="#00e5ff" opacity="0.09"/>
  <!-- Dashed cross lines -->
  <line x1="60" y1="52" x2="140" y2="148"
    stroke="#00e5ff" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="5,5"/>
  <line x1="140" y1="52" x2="60" y2="148"
    stroke="#00e5ff" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="5,5"/>
  <!-- Center jewel layers -->
  <polygon points="100,76 120,100 100,124 80,100" fill="#00e5ff" opacity="0.95"/>
  <polygon points="100,82 114,100 100,118 86,100" fill="#b2f0ff" opacity="0.85"/>
  <polygon points="100,88 108,100 100,112 92,100" fill="#ffffff" opacity="0.9"/>
  <!-- Corner dots -->
  <circle cx="100" cy="8" r="4" fill="#00e5ff" opacity="0.8"/>
  <circle cx="168" cy="48" r="4" fill="#00e5ff" opacity="0.6"/>
  <circle cx="168" cy="128" r="4" fill="#00e5ff" opacity="0.6"/>
  <circle cx="100" cy="168" r="4" fill="#00e5ff" opacity="0.8"/>
  <circle cx="32" cy="128" r="4" fill="#00e5ff" opacity="0.6"/>
  <circle cx="32" cy="48" r="4" fill="#00e5ff" opacity="0.6"/>
</svg>
```

### `src/assets/logo-banner.svg` (Horizontal 300×60)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60">
  <!-- Mini hex icon -->
  <polygon points="28,3 48,14 48,36 28,47 8,36 8,14"
    fill="#060c16" stroke="#00e5ff" stroke-width="1.5"/>
  <polygon points="28,10 42,18 42,32 28,40 14,32 14,18"
    fill="none" stroke="#00e5ff" stroke-width="0.5" opacity="0.2"/>
  <polygon points="28,11 40,25 28,39 16,25"
    fill="none" stroke="#00e5ff" stroke-width="1.5"/>
  <polygon points="28,11 40,25 28,25" fill="#00e5ff" opacity="0.1"/>
  <polygon points="16,25 28,25 28,39" fill="#00e5ff" opacity="0.07"/>
  <polygon points="28,18 34,25 28,32 22,25" fill="#00e5ff" opacity="0.95"/>
  <polygon points="28,20 32,25 28,30 24,25" fill="#b2f0ff" opacity="0.8"/>
  <polygon points="28,22 30,25 28,28 26,25" fill="#ffffff" opacity="0.9"/>
  <!-- Wordmark -->
  <text x="62" y="34" font-family="Poppins,sans-serif"
    font-size="24" font-weight="800" fill="#ffffff">xen<tspan fill="#00e5ff">drx</tspan></text>
  <text x="63" y="49" font-family="Poppins,sans-serif"
    font-size="8" fill="rgba(255,255,255,0.3)" letter-spacing="2.5">P2P CRYPTO EXCHANGE</text>
</svg>
```

### `src/assets/favicon.svg` (32×32)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#080d18"/>
  <polygon points="16,2 26,8 26,22 16,28 6,22 6,8"
    fill="#060c16" stroke="#00e5ff" stroke-width="1.2"/>
  <polygon points="16,8 22,13 22,19 16,24 10,19 10,13"
    fill="none" stroke="#00e5ff" stroke-width="0.4" opacity="0.2"/>
  <polygon points="16,8 22,16 16,24 10,16"
    fill="none" stroke="#00e5ff" stroke-width="1.2"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#00e5ff" opacity="0.95"/>
  <polygon points="16,13 19,16 16,19 13,16" fill="#b2f0ff" opacity="0.8"/>
  <polygon points="16,14 18,16 16,18 14,16" fill="#ffffff" opacity="0.9"/>
</svg>
```

---

## PART 2 — UPDATE index.html

```html
<title>Xendrx — P2P Crypto Exchange</title>
<meta name="description" content="Xendrx — Fast, secure P2P crypto exchange. Buy and sell USDT instantly.">
<meta name="theme-color" content="#080d18">
<meta name="application-name" content="Xendrx">
<meta property="og:title" content="Xendrx">
<meta property="og:description" content="P2P Crypto Exchange — Swap · Trade · Grow">
<meta property="og:site_name" content="Xendrx">
<link rel="icon" type="image/svg+xml" href="/src/assets/favicon.svg">
<link rel="apple-touch-icon" href="/src/assets/logo-icon.svg">
```

---

## PART 3 — UPDATE CSS VARIABLES

In `src/index.css` or global CSS, update brand colors:

```css
:root {
  --brand-bg: #080d18;
  --brand-bg-secondary: #0c1420;
  --brand-bg-card: #060c16;
  --brand-accent: #00e5ff;
  --brand-accent-dim: rgba(0, 229, 255, 0.15);
  --brand-accent-border: rgba(0, 229, 255, 0.3);
  --brand-text: #ffffff;
  --brand-muted: #8899aa;
}
```

---

## PART 4 — UPDATE EVERY PAGE HEADER/NAVBAR

Replace any text logo or old logo with:

```tsx
import LogoBanner from '@/assets/logo-banner.svg';

// Every page header:
<img src={LogoBanner} alt="Xendrx" height={40}
  style={{ display: 'block' }} />

// In JSX wordmark format:
<span style={{ fontFamily: 'Poppins', fontWeight: 800, fontSize: '22px' }}>
  xen<span style={{ color: '#00e5ff' }}>drx</span>
</span>

// Admin sidebar:
import LogoIcon from '@/assets/logo-icon.svg';
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
  <img src={LogoIcon} alt="Xendrx" width={36} height={36} />
  <span style={{ color: '#fff', fontWeight: 800, fontSize: '18px',
    fontFamily: 'Poppins' }}>
    xen<span style={{ color: '#00e5ff' }}>drx</span>
  </span>
</div>
```

---

## PART 5 — FIND AND REPLACE ALL TEXT

Run these replacements across ALL .tsx .ts .html .css .json files:

| Find | Replace |
|---|---|
| `SwapBirr` | `Xendrx` |
| `Swap Birr` | `Xendrx` |
| `swapbirr` | `xendrx` |
| `SWAPBIRR` | `XENDRX` |
| `EthioP2P` | `Xendrx` |
| `ethiop2p` | `xendrx` |
| `support@swapbirr.com` | `support@xendrx.com` |
| `admin@swapbirr.com` | `admin@xendrx.com` |
| `support@ethiop2p.com` | `support@xendrx.com` |
| `admin@ethiop2p.com` | `admin@xendrx.com` |
| `swapbirr.com` | `xendrx.com` |
| `ethiop2p.com` | `xendrx.com` |
| `Swap · Trade · Grow` | `Swap · Trade · Grow` |
| `P2P CRYPTO EXCHANGE` | `P2P CRYPTO EXCHANGE` |

### Specific UI text:

```
Auth page:
  "JOIN SWAPBIRR!" → "JOIN XENDRX!"
  "JOIN ETHIOP2P!" → "JOIN XENDRX!"
  "Fast & secure P2P exchange" → stays same ✅
  "Welcome to SwapBirr!" → "Welcome to Xendrx!"

Login page:
  "Login to continue trading on SwapBirr"
  → "Login to continue trading on Xendrx"

KYC page:
  Remove any country-specific ID types
  Keep only: National ID · Passport · Driver's License
  Remove: Kebele ID (country specific)

Card coming soon page:
  "SwapBirr Card is on its way"
  → "Xendrx Card is on its way"
  "SwapBirr Card" → "Xendrx Card"

Footer:
  "© 2026 SwapBirr" → "© 2026 Xendrx"
  "© 2026 EthioP2P" → "© 2026 Xendrx"

Browser tabs:
  "SwapBirr — ..." → "Xendrx — ..."
  "EthioP2P — ..." → "Xendrx — ..."

Admin panel:
  "SwapBirr Admin" → "Xendrx Admin"
  "EthioP2P Admin" → "Xendrx Admin"

Safety messages in chat:
  "via the SwapBirr platform" → "via the Xendrx platform"
  "via the EthioP2P platform" → "via the Xendrx platform"
  "Contact support@swapbirr.com" → "Contact support@xendrx.com"

Email subjects:
  "[SwapBirr]" → "[Xendrx]"
  "[EthioP2P]" → "[Xendrx]"

Suspension message:
  "Contact support@swapbirr.com" → "Contact support@xendrx.com"

Notifications:
  "Welcome to SwapBirr!" → "Welcome to Xendrx!"
  "trade on SwapBirr!" → "trade on Xendrx!"
  "SwapBirr escrow" → "Xendrx escrow"
  "locked by Xendrx escrow" stays same ✅

P2P tips:
  "via SwapBirr platform only" → "via Xendrx platform only"

P2P service agreement:
  "SwapBirr P2P Service Agreement"
  → "Xendrx P2P Service Agreement"
```

---

## PART 6 — UPDATE AUTH PAGE

In `auth_v2.html` or `src/pages/auth.tsx`:

```html
<!-- Replace logo: -->
<img src="/src/assets/logo-banner.svg" alt="Xendrx"
  style="height:48px; margin:0 auto 24px; display:block;">

<!-- Welcome text register panel: -->
"JOIN XENDRX!"

<!-- Login panel subtitle: -->
"Login to continue trading on Xendrx"

<!-- Register panel subtitle: -->
"Fast & secure P2P exchange"
```

---

## PART 7 — UPDATE .env

```env
APP_NAME=Xendrx
APP_URL=https://xendrx.com
SUPPORT_EMAIL=support@xendrx.com
ADMIN_EMAIL=admin@xendrx.com
```

---

## PART 8 — UPDATE DATABASE

```sql
UPDATE system_settings
SET value = 'Xendrx'
WHERE key = 'platform_name';

UPDATE system_settings
SET value = 'support@xendrx.com'
WHERE key = 'support_email';
```

---

## PART 9 — UPDATE PACKAGE.JSON

```json
{
  "name": "xendrx",
  "description": "Xendrx P2P Crypto Exchange",
  "version": "1.0.0"
}
```

---

## PART 10 — UPDATE ADMIN PANEL

```tsx
// Admin login page:
<h1 style={{ fontFamily: 'Poppins', fontWeight: 800 }}>
  xen<span style={{ color: '#00e5ff' }}>drx</span>
  <span style={{ fontSize: '14px', color: '#8899aa',
    fontWeight: 400, marginLeft: '8px' }}>Admin</span>
</h1>
<p style={{ color: '#8899aa' }}>Secure admin access</p>

// Admin sidebar header:
<div style={{ padding: '20px 16px',
  borderBottom: '1px solid #1e2d3d',
  display: 'flex', alignItems: 'center', gap: '10px' }}>
  <img src="/src/assets/logo-icon.svg"
    width={36} height={36} alt="Xendrx" />
  <div>
    <div style={{ fontFamily: 'Poppins', color: '#fff',
      fontWeight: 800, fontSize: '18px' }}>
      xen<span style={{ color: '#00e5ff' }}>drx</span>
    </div>
    <div style={{ color: '#556677', fontSize: '10px',
      letterSpacing: '1px' }}>ADMIN PANEL</div>
  </div>
</div>
```

---

## PART 11 — UPDATE NOTIFICATIONS

In `artifacts/api-server/src/helpers/notify.ts`:

```typescript
// Welcome on register:
message: 'Welcome to Xendrx! Complete KYC to start trading.'

// KYC approved:
message: 'Your identity has been verified. You can now trade on Xendrx!'

// KYC rejected:
message: 'Your KYC was rejected. Please resubmit on Xendrx.'

// Order created:
message: 'New order received on Xendrx'

// Suspension:
message: `Account suspended. Contact support@xendrx.com`

// Order completed buyer:
message: 'USDT deposited to your Xendrx wallet!'
```

---

## PART 12 — UPDATE SAFETY MESSAGES

In `src/pages/chat.tsx` and `src/pages/trade.tsx`:

```typescript
// Warning banner:
'Please do not use third-party platforms for communication,
as external chat history cannot be used as valid evidence
in Xendrx order disputes.'

// Platform notice modal:
'1. Please do not use third-party platforms for communication.'
'2. The crypto in this order has been locked by Xendrx escrow
    and your order is securely protected.'

// P2P trading tips:
'1. Always communicate via Xendrx platform only.'
'2. If you paid, do not cancel. File an appeal instead.'

// Release warning:
'Only release AFTER confirming payment received in your account.'
```

---

## PART 13 — BRAND GUIDELINES (add as code comments)

```
Xendrx Brand Guidelines:
- Logo: Crystal Diamond Hexagon icon
- Primary background: #080d18 (deep dark navy)
- Secondary background: #0c1420
- Card background: #060c16
- Primary accent: #00e5ff (electric cyan)
- Accent dim: rgba(0,229,255,0.15)
- Font: Poppins 800 for logo
- Wordmark: xen (white) + drx (cyan) — all lowercase
- Tagline: "Swap · Trade · Grow"
- Domain: xendrx.com
- Support: support@xendrx.com
- No country or region mentioned anywhere
- Global brand only
- Logo minimum: banner 160px wide, icon 32px
- Always on dark background only
- Never change brand colors
```

---

## VERIFICATION CHECKLIST

After all changes verify:
- [ ] Browser tab: "Xendrx — ..."
- [ ] Auth page: "JOIN XENDRX!" + Xendrx logo
- [ ] Wallet header: Xendrx banner logo
- [ ] P2P page: Xendrx branding
- [ ] Admin panel: "xendrx Admin"
- [ ] Admin login: "xendrx Admin"
- [ ] No "SwapBirr" text anywhere
- [ ] No "EthioP2P" text anywhere
- [ ] No country name anywhere
- [ ] Support email: support@xendrx.com
- [ ] Card page: "Xendrx Card"
- [ ] Notifications say "Xendrx"
- [ ] Chat safety says "Xendrx platform"
- [ ] Copyright: "© 2026 Xendrx"
- [ ] favicon shows hex diamond icon
- [ ] App icon shows hex diamond icon

