# SwapBirr — Complete Rebrand Prompt
# Rename everything from EthioP2P to SwapBirr
# Paste this into Replit AI

---

## IMPORTANT
- Replace ALL instances of "EthioP2P" with "SwapBirr"
- Replace ALL instances of "ethiop2p" with "swapbirr"
- Replace ALL instances of "EthioFuture" references in demo data
- Do NOT mention Ethiopia anywhere in the UI
- Do NOT touch any functionality — rebrand only
- Brand colors stay the same: #0a1628 dark + #00d4ff cyan + Poppins font

---

## PART 1 — CREATE LOGO SVG FILES

### File: `src/assets/logo-icon.svg` (App icon 512x512)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="40" fill="#0a1628"/>
  <rect width="200" height="200" rx="40" fill="none" stroke="#00d4ff" stroke-width="3" opacity="0.5"/>
  <circle cx="100" cy="100" r="72" fill="#0d1e36" stroke="#00d4ff" stroke-width="2.5"/>
  <circle cx="100" cy="100" r="56" fill="none" stroke="#00d4ff" stroke-width="0.8" opacity="0.2"/>
  <!-- Top arrow left to right -->
  <path d="M40,78 C40,62 58,54 76,56 L108,56" fill="none" stroke="#00d4ff" stroke-width="6" stroke-linecap="round"/>
  <path d="M100,42 L120,56 L100,70" fill="none" stroke="#00d4ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Bottom arrow right to left -->
  <path d="M160,122 C160,138 142,146 124,144 L92,144" fill="none" stroke="#00d4ff" stroke-width="6" stroke-linecap="round"/>
  <path d="M100,158 L80,144 L100,130" fill="none" stroke="#00d4ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Center diamond -->
  <rect x="88" y="88" width="24" height="24" rx="6" fill="#00d4ff" opacity="0.95" transform="rotate(45 100 100)"/>
  <rect x="92" y="92" width="16" height="16" rx="4" fill="#0a1628" transform="rotate(45 100 100)"/>
</svg>
```

### File: `src/assets/logo-banner.svg` (Horizontal 300x60)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60">
  <!-- Mini swap icon -->
  <circle cx="28" cy="30" r="26" fill="#0d1e36" stroke="#00d4ff" stroke-width="1.5"/>
  <circle cx="28" cy="30" r="20" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.2"/>
  <path d="M12,22 C12,17 18,15 22,16 L30,16" fill="none" stroke="#00d4ff" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M28,11 L36,16 L28,21" fill="none" stroke="#00d4ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M44,38 C44,43 38,45 34,44 L26,44" fill="none" stroke="#00d4ff" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M28,49 L20,44 L28,39" fill="none" stroke="#00d4ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="23" y="25" width="10" height="10" rx="2.5" fill="#00d4ff" opacity="0.9" transform="rotate(45 28 30)"/>
  <rect x="25" y="27" width="6" height="6" rx="1.5" fill="#0a1628" transform="rotate(45 28 30)"/>
  <!-- Wordmark -->
  <text x="66" y="34" font-family="Poppins,sans-serif" font-size="24" font-weight="800" fill="#ffffff">Swap<tspan fill="#00d4ff">Birr</tspan></text>
  <text x="67" y="48" font-family="Poppins,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" letter-spacing="2.5">P2P CRYPTO EXCHANGE</text>
</svg>
```

### File: `src/assets/favicon.svg` (32x32)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0a1628"/>
  <text x="16" y="22" text-anchor="middle" font-family="Poppins,sans-serif" font-size="14" font-weight="800" fill="#00d4ff">SB</text>
</svg>
```

---

## PART 2 — UPDATE index.html

```html
<!-- In public/index.html or index.html: -->
<title>SwapBirr — P2P Crypto Exchange</title>
<meta name="description" content="SwapBirr — Fast, secure P2P crypto exchange. Buy and sell USDT instantly.">
<meta name="theme-color" content="#0a1628">
<meta property="og:title" content="SwapBirr">
<meta property="og:description" content="P2P Crypto Exchange — Swap · Trade · Grow">
<meta property="og:site_name" content="SwapBirr">
<link rel="icon" type="image/svg+xml" href="/src/assets/favicon.svg">
<link rel="apple-touch-icon" href="/src/assets/logo-icon.svg">
```

---

## PART 3 — UPDATE EVERY PAGE HEADER/NAVBAR

Replace any text logo or old logo image with:

```tsx
import LogoBanner from '@/assets/logo-banner.svg';

// In every page header:
<img src={LogoBanner} alt="SwapBirr" height={40} style={{ display: 'block' }} />

// In admin sidebar:
import LogoIcon from '@/assets/logo-icon.svg';
<img src={LogoIcon} alt="SwapBirr" width={36} height={36} />
<span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>
  Swap<span style={{ color: '#00d4ff' }}>Birr</span>
</span>
```

---

## PART 4 — FIND AND REPLACE ALL TEXT

Run these replacements across ALL files in the project:

### In all .tsx, .ts, .html, .css, .json files:

| Find | Replace |
|---|---|
| `EthioP2P` | `SwapBirr` |
| `Ethio P2P` | `SwapBirr` |
| `ethiop2p` | `swapbirr` |
| `ethiop2p` | `swapbirr` |
| `ETHIOP2P` | `SWAPBIRR` |
| `Ethiopia's P2P Crypto Exchange` | `P2P Crypto Exchange` |
| `Ethiopia's trusted P2P exchange` | `Fast & secure P2P exchange` |
| `Ethiopia's first P2P crypto exchange` | `The smarter P2P crypto exchange` |
| `support@ethiop2p.com` | `support@swapbirr.com` |
| `admin@ethiop2p.com` | `admin@swapbirr.com` |
| `EthioFuture` (demo username) | `SwapUser` |

### Specific UI text to update:

```
Auth page welcome text:
  OLD: "JOIN ETHIO P2P!" → NEW: "JOIN SWAPBIRR!"
  OLD: "Ethiopia's trusted P2P exchange" → NEW: "Fast & secure P2P exchange"
  OLD: "LOGIN WELCOME BACK" stays same ✅

KYC page:
  Remove any mention of "Ethiopia" from instructions
  Keep: "National ID", "Passport", "Driver's License" (remove "Kebele ID" — Ethiopia specific)

Coming soon card page:
  OLD: "EthioP2P Card is on its way" → NEW: "SwapBirr Card is on its way"
  OLD: "Powered by blockchain technology" stays same ✅

Footer/copyright:
  OLD: "© 2026 EthioP2P" → NEW: "© 2026 SwapBirr"

Admin panel title:
  OLD: "EthioP2P Admin" → NEW: "SwapBirr Admin"

Browser tab titles:
  OLD: "EthioP2P — ..." → NEW: "SwapBirr — ..."

System notifications:
  OLD: "Welcome to EthioP2P!" → NEW: "Welcome to SwapBirr!"
  OLD: "EthioP2P P2P Service Agreement" → NEW: "SwapBirr P2P Service Agreement"

Safety messages in chat:
  OLD: "via the MEXC platform" → "via the SwapBirr platform"
  OLD: "Contact support@ethiop2p.com" → "Contact support@swapbirr.com"

Email subjects (if any):
  OLD: "[EthioP2P]" → NEW: "[SwapBirr]"
```

---

## PART 5 — UPDATE PACKAGE.JSON

```json
{
  "name": "swapbirr",
  "description": "SwapBirr P2P Crypto Exchange",
  "version": "1.0.0"
}
```

---

## PART 6 — UPDATE .env

```env
# Old:
# ADMIN_EMAIL=admin@ethiop2p.com

# New:
ADMIN_EMAIL=admin@swapbirr.com
APP_NAME=SwapBirr
APP_URL=https://swapbirr.com
SUPPORT_EMAIL=support@swapbirr.com
```

---

## PART 7 — UPDATE AUTH PAGE (auth_v2.html)

In `auth_v2.html` or `src/pages/auth.tsx`:

```html
<!-- Replace logo div: -->
<!-- OLD: -->
<div class="logo">Ethio<span>P2P</span></div>

<!-- NEW: -->
<img src="/src/assets/logo-banner.svg" alt="SwapBirr"
  style="height: 48px; margin-bottom: 24px; display: block; margin-left: auto; margin-right: auto;">
```

Update welcome text:
```
Login panel right side:
  "WELCOME BACK!" ✅ keep
  "Login to continue trading on EthioP2P"
  → "Login to continue trading on SwapBirr"

Register panel left side:
  "JOIN ETHIO P2P!" → "JOIN SWAPBIRR!"
  "Ethiopia's trusted P2P exchange"
  → "Fast & secure P2P exchange"
```

---

## PART 8 — UPDATE SYSTEM SETTINGS IN DATABASE

```sql
UPDATE system_settings
SET value = 'SwapBirr'
WHERE key = 'platform_name';

UPDATE system_settings
SET value = 'support@swapbirr.com'
WHERE key = 'support_email';
```

---

## PART 9 — UPDATE ADMIN PANEL BRANDING

In `/admin` layout:

```tsx
// Admin sidebar header:
<div style={{ padding: '20px 16px', borderBottom: '1px solid #1e2d3d',
  display: 'flex', alignItems: 'center', gap: '10px' }}>
  <img src="/src/assets/logo-icon.svg" width={36} height={36} alt="SwapBirr" />
  <div>
    <div style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>
      Swap<span style={{ color: '#00d4ff' }}>Birr</span>
    </div>
    <div style={{ color: '#556677', fontSize: '10px', letterSpacing: '1px' }}>
      ADMIN PANEL
    </div>
  </div>
</div>

// Admin login page title:
<h1>Swap<span style={{ color: '#00d4ff' }}>Birr</span> Admin</h1>
<p>Secure admin access</p>
```

---

## PART 10 — UPDATE NOTIFICATION MESSAGES

In `artifacts/api-server/src/helpers/notify.ts`:

```typescript
// Update all notification messages that mention EthioP2P:

// Welcome notification (sent on register):
message: 'Welcome to SwapBirr! Complete KYC to start trading.'

// KYC approved:
message: 'Your identity has been verified. You can now trade on SwapBirr!'

// Order created:
message: 'New order received on SwapBirr'

// Support email in suspension message:
message: `Account suspended. Contact support@swapbirr.com`
```

---

## PART 11 — UPDATE P2P SAFETY MESSAGES

In `src/pages/chat.tsx` and `src/pages/trade.tsx`:

```typescript
// Warning banner:
'Please do not use third-party platforms for communication,
as external chat history cannot be used as valid evidence
in SwapBirr order disputes.'

// Platform notice modal:
'1. Please do not use third-party platforms for communication.'
'2. The crypto in this order has been locked by SwapBirr escrow.'

// P2P trading tips:
'1. Always communicate via SwapBirr platform only.'
'2. If you paid, do not cancel. File an appeal instead.'
```

---

## PART 12 — LOGO USAGE RULES (add as comments)

```
SwapBirr Brand Guidelines:
- Primary background: #0a1628 (dark navy)
- Primary accent: #00d4ff (neon cyan)
- Font: Poppins 800 for logo, Poppins 400/600 for UI
- Logo minimum size: banner 160px wide, icon 32px
- Always on dark background only
- Never stretch or distort
- Never change colors
- Tagline: "Swap · Trade · Grow"
- No country or region mentioned in UI
- Global brand — works for all countries
```

---

## VERIFICATION CHECKLIST

After making all changes, verify:
- [ ] Browser tab shows "SwapBirr — ..."
- [ ] Auth page shows SwapBirr logo + "JOIN SWAPBIRR!"
- [ ] Wallet page header shows SwapBirr banner logo
- [ ] P2P page header shows SwapBirr
- [ ] Admin panel shows SwapBirr Admin
- [ ] No "EthioP2P" text visible anywhere in UI
- [ ] No "Ethiopia" text visible anywhere in UI
- [ ] Support email shows support@swapbirr.com
- [ ] Notification messages say SwapBirr
- [ ] Card page says "SwapBirr Card"
- [ ] Auth welcome says "JOIN SWAPBIRR!"

