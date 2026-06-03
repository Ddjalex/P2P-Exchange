# P2P Exchange — Master Replit Prompt
> Binance-style P2P Exchange for Ethiopia
> Stack: HTML + CSS + JS (or React) — Mobile First
> Theme: Dark `#1a1a2e` bg · Neon cyan `#00d4ff` accent · Poppins font

---

## IMPORTANT SETUP NOTES

- Auth pages (Login/Register) will be added LATER using `AuthScreen.zip`
- For now build all screens below with a simple dev bypass login
- Mobile-first, max-width 480px, centered on desktop
- All screens share the same dark theme: background `#1a1a2e`, accent `#00d4ff`, font Poppins
- Bottom navigation is fixed on all screens — no page reload, pure JS screen switching
- All amounts formatted with comma separators (e.g. 74,000)
- Loading spinners on all async actions
- Toast notifications for success/error

---

## GLOBAL BOTTOM NAVIGATION BAR

Fixed at bottom of every screen. 5 tabs:

| Tab | Icon | Route |
|---|---|---|
| P2P | two-people | `/p2p` |
| Orders | clock/receipt | `/orders` |
| Ads | megaphone | `/ads` |
| Chat | message bubble | `/chat` |
| Profile | person | `/profile` |

- Active tab: `#00d4ff` neon cyan
- Inactive: muted grey `#8899aa`
- Chat tab shows unread count badge in yellow circle
- No page reload — JS tab switching

---

## SCREEN 1 — WALLET PAGE (main landing screen after login)

Route: `/wallet`

### Header
- Left: app logo + name
- Right: notification bell icon + settings icon

### KYC Banner (shown until KYC status = `verified`)
- Yellow/orange bar
- Text: "Complete identity verification to start trading"
- "Verify Now" link → `/kyc`
- Status variants:
  - Pending → yellow: "Verification under review — we'll notify you shortly"
  - Rejected → red: "KYC Rejected — Resubmit your documents" + "Resubmit" button
  - More Info → orange: "Action Required — Update your submission" + "Update" button
  - Verified → banner hidden completely

### Balance Card
- Label: "Total Balance"
- Large number: `0.00 USDT`
- Subtext: `≈ 0.00 ETB`
- Eye icon to show/hide balance
- Two buttons side by side:
  - Deposit → neon cyan filled button
  - Withdraw → outline button

### Asset List
- Single asset row: USDT only
  - USDT logo + "USDT" + "Tether"
  - Available: `0.00`
  - Frozen: `0.00`
  - ETB value: `≈ 0.00 ETB`
  - Tap → opens USDT detail page

### USDT Detail Page
- Balance breakdown: Available / Frozen / Total
- Action buttons: Deposit · Withdraw · Transfer
- Transaction history list (empty state: "No transactions yet")
- Each transaction row: type · amount · date · status badge · txid (copyable)

### Deposit Flow
- Network selector: TRC20 / ERC20
- USDT wallet address (generated per user per network)
- QR code of address
- Copy address button (copies to clipboard + toast)
- Warning: "Only send USDT to this address. Sending other assets may result in permanent loss."
- Minimum deposit amount shown

### Withdraw Flow
- Destination wallet address input
- Network selector: TRC20 / ERC20
- Amount input + "All" button (fills max available)
- Available balance shown below input
- Estimated fee shown
- Minimum withdrawal amount shown
- Received amount = entered amount − fee
- Confirm Withdrawal button → opens PIN/2FA confirmation dialog
- Validation: address format check, sufficient balance check

---

## SCREEN 2 — P2P MARKETPLACE

Route: `/p2p`

### Header
- Left: back arrow
- Center: "Express" (muted grey, tappable) · "P2P" (bold white, active)
- Right: ETB currency badge (locked to ETB only, styled as pill button)
- Notification bell icon

### Buy / Sell Toggle
- Pill-style toggle: Buy (active = white filled pill) / Sell
- Smooth CSS transition on switch
- Buy tab shows ads from sellers (people selling USDT for ETB)
- Sell tab shows ads from buyers (people buying USDT for ETB)

### Filter Bar
- USDT dropdown (locked, only USDT — styled as active filter pill)
- Amount dropdown → input ETB amount to filter matching ads
- Payment dropdown → filter by payment method (CBE / Telebirr / Awash / Dashen / Abyssinia / HelloCash)
- Filter icon (right) → opens advanced filter bottom sheet:
  - Available amount range slider
  - Payment method multi-select
  - Reset filters button

### Ad Cards (scrollable list)
Each card:
- Row 1: Trader avatar (initials circle) + username + merchant badge (if merchant)
- Row 2: Stats — "X orders · XX% completion"
- Row 3: Price — `XXX.XX ETB` per USDT (large bold white)
- Row 4: Available `XXXX USDT` · Limit `XXX ETB ~ XXX,XXX ETB`
- Row 5: Payment method tags (e.g. CBE · Telebirr)
- Row 6: "Buy USDT" or "Sell USDT" button (neon cyan filled, full width)
- Divider between cards

### Empty State
- Illustration icon (document with exclamation)
- Text: "No Ads"
- "Reset filter" button (outline style)

### Tapping "Buy USDT" or "Sell USDT"
→ Opens Trade Order screen (see Screen 7)

---

## SCREEN 3 — POST AD (3-step wizard)

Route: `/ads/post` — accessed from Ads tab → "Post Ad" button

### Progress Bar
3 steps at top, connected by line:
- Step 1: Set Type & Price
- Step 2: Set Amount & Method
- Step 3: Set Conditions
- Completed steps: ✅ checkmark
- Active step: neon cyan number circle
- Inactive steps: grey circle

---

### STEP 1 — Set Type & Price

- "I want to" label
- Buy / Sell toggle (two equal full-width buttons, selected = white bg)
- Asset: USDT (locked dropdown, shows USDT)
- With Fiat: ETB (locked dropdown, shows ETB)
- Price Type dropdown → opens bottom sheet:
  - Fixed ✅ — "Set a constant price, unaffected by market fluctuations"
  - Floating — "Floating price = Market price × price margin"
  - Checkmark on selected option
- If Fixed selected:
  - Stepper: [−] [price input] [+]
  - Price range shown below: "Price range: XXX.XX − XXX.XX"
  - "Your Price: XXX.XX ETB"
  - If Buy: "Highest Order Price: XXX.XX ETB"
  - If Sell: "Lowest Ad Price: XXX.XX ETB"
- If Floating selected:
  - Percentage input (e.g. 101%)
  - Calculated price shown live
- Next button (neon cyan, full width)

---

### STEP 2 — Set Amount & Method

- Total Amount input (USDT) + "All" button → fills max available balance
- Below input: `≈ 0.00 ETB` · `Available: 0.00 USDT` + deposit shortcut icon
- Order Limit section:
  - Min input [ETB] ~ Max input [ETB]
  - Below each: USDT equivalent shown in muted text
- Payment Method:
  - Label: "Select up to 5 methods" + "+ Add" button
  - Ethiopian payment options:
    - CBE (Commercial Bank of Ethiopia)
    - Telebirr
    - Awash Bank
    - Dashen Bank
    - Abyssinia Bank
    - HelloCash
    - M-Pesa
  - Selected methods shown as removable tags
  - Red error if none selected: "Please select at least one payment method"
- Payment Time Limit dropdown: 15 Min / 30 Min / 1 Hour
- Reserved Fee: shown as `0 USDT` with info icon
- Previous (grey) + Next (neon cyan) buttons

---

### STEP 3 — Set Conditions

- Auto-reply (Optional):
  - Textarea, placeholder: "The auto-reply message will be sent to the counterparty once the order is created"
  - Character counter: 0/1000
- Counterparty Conditions section:
  - Subtext: "Adding counterparty requirements will reduce the exposure of your Ad"
  - ☐ Registered [X] Day(s) ago — number input
  - ☐ Holdings more than [X] USDT — number input
  - ☐ Non-merchant checkbox
- Display to Users In:
  - Dropdown: All Regions / Ethiopia Only
- Status (radio buttons):
  - 🔵 Online (default)
  - ⚪ Offline
  - ⚪ Private
- Previous (grey) + Preview (neon cyan) buttons

---

### PREVIEW AD — bottom sheet

- Title: "Preview Ad"
- "Buy/Sell USDT With ETB" + Online/Offline/Private badge
- Summary rows:
  - Price
  - Price Type
  - Total Amount
  - Actual Amount (after platform fee deducted)
  - Estimated Fee
  - Limit (min ~ max ETB)
  - Payment Methods
  - Payment Time Limit
  - Display to Users In
- Edit (grey) + Post (neon cyan) buttons
- On Post → save ad, redirect to Ads list with success toast

---

## SCREEN 4 — MY ADS LIST

Route: `/ads`

### Header
- "Ads" title
- "+ Post Ad" button (top right, neon cyan)

### Tabs
- All · Online · Offline · Private (yellow underline on active)

### Ad Cards
Each ad card:
- Buy/Sell badge + USDT label
- Status badge: Online (green) / Offline (grey) / Private (blue)
- Price: XXX.XX ETB per USDT
- Available / Total: X USDT / X USDT
- Limit: XXX ~ XXX,XXX ETB
- Payment methods tags
- Action buttons: Edit · Online/Offline toggle · Delete

### Empty State
- "No ads yet" + "Post your first ad" button

---

## SCREEN 5 — ORDER HISTORY

Route: `/orders`

### Header
- "Order History" title
- Download/export icon (top right)

### Top Tabs
- Ongoing · Fulfilled (yellow underline on active)

### Search + Filter icons (top right)

### Ongoing Sub-filters
All · Unpaid · Paid · Appeal

### Fulfilled Sub-filters
All · Completed · Cancelled · Appeal

### Order Cards (Fulfilled)
- "Buy USDT" (green) or "Sell USDT" (red) label — left
- Status badge (Completed / Cancelled) — right
- Amount: `Br XX,XXX` (bold)
- Price: `Br XXX.XX`
- Received Quantity: `XXX.XX USDT`
- Order ID: long number + 📋 copy icon
- Trader name + chat icon + unread message badge (yellow)
- Timestamp: `MM-DD HH:MM:SS`
- Divider between cards

### Unread message banner (if any)
- "You have unread messages" + arrow → opens chat

### Empty State
- Illustration + "No records found"

---

## SCREEN 6 — P2P CHAT / MESSAGES

Route: `/chat`

### Header
- "P2P Message" title
- User avatar circle (initials) — right
- "+" new chat icon — right

### Search Bar
- Placeholder: "Search by nickname"
- Filters conversation list in real time

### Tabs
- All · For You (yellow underline on active)

### Special Row (top of list)
- "Go to Main Chat" — chat bubble icon, grey background

### Conversation List Items
- Avatar circle (initials, grey background)
- Username (bold) + merchant/verified badge if applicable
- Last message preview (truncated, muted grey)
- Date (right, muted)
- Unread count badge (yellow circle with number)

### Chat Thread (tapping a conversation)
- Header: trader name + back arrow + order reference
- Order info bar at top: Order ID · Amount · Status
- Message bubbles:
  - Sent (right): neon cyan background, dark text
  - Received (left): dark card background, white text
- System messages centered (e.g. "Order created", "Payment marked")
- Attachment icon (image upload)
- Text input + send button

---

## SCREEN 7 — TRADE / ORDER FLOW

Route: `/trade/:orderId`

This screen is opened when a user taps "Buy USDT" or "Sell USDT" on an ad card.

### ORDER CONFIRMATION SCREEN

- Header: "Buy USDT" or "Sell USDT" + back arrow
- Ad summary card:
  - Trader name + avatar + stats (X orders · XX% completion)
  - Price: XXX.XX ETB per USDT
  - Payment method tags
  - Payment time limit
- Amount input section:
  - "I will pay" input (ETB) ↔ auto-calculates "I will receive" (USDT)
  - OR "I will receive" input (USDT) ↔ auto-calculates "I will pay" (ETB)
  - Min/Max limit shown below input
  - Input validation: within min/max range
- Payment method selector (from ad's available methods)
- Terms checkbox: "I have read and agree to Binance P2P Service Agreement"
- "Buy USDT" / "Sell USDT" confirm button (neon cyan, full width)
- Disabled if KYC not verified → shows "Complete KYC to trade" message

### ORDER CREATED — PAYMENT INSTRUCTIONS SCREEN

After confirming order, show:

- Countdown timer (e.g. 15:00 counting down — payment time limit)
  - Timer in large neon cyan numbers
  - If expires → order auto-cancelled
- Order ID (copyable)
- Status: "Waiting for Payment" (buyer) / "Waiting for Buyer Payment" (seller)

**For BUYER:**
- Payment instructions card:
  - "Transfer ETB to seller's account"
  - Payment method name (e.g. CBE)
  - Account name (bold)
  - Account number (bold, copyable with copy icon)
  - Amount to pay: `XXX,XXX ETB` (bold neon cyan, copyable)
  - Warning: "After transferring, click 'Transferred, Notify Seller'"
- Two buttons:
  - "Cancel Order" (grey outline) — only available in first 15 min
  - "Transferred, Notify Seller" (neon cyan filled)
- Chat button (floating) → opens order chat thread

**For SELLER:**
- "Waiting for buyer to transfer payment"
- Buyer's payment method shown
- Amount to receive shown
- "Confirm Release" button (disabled until buyer marks as paid)
- "Raise Appeal" button (outline)
- Chat button

### PAYMENT CONFIRMED SCREEN (after buyer taps "Transferred, Notify Seller")

**Seller sees:**
- Alert: "Buyer has marked payment as sent"
- Payment proof section (if buyer uploaded screenshot)
- Account details to verify payment
- Two buttons:
  - "Raise Appeal" (grey outline)
  - "Release Crypto" (neon cyan filled) — confirm received payment

**Release confirmation dialog:**
- "Are you sure you want to release X USDT to the buyer?"
- Warning: "Only release after confirming payment received in your account"
- Cancel + Confirm buttons

### ORDER COMPLETED SCREEN

- Large ✅ animated checkmark (neon cyan)
- "Order Completed!"
- Summary:
  - You received: `XXX.XX USDT` (buyer) OR `XXX,XXX ETB` (seller)
  - Order ID (copyable)
  - Trader name
- Rating/Feedback section:
  - 👍 Positive / 👎 Negative (two buttons)
  - Optional comment textarea (0/200 chars)
  - "Submit Feedback" button
- "Back to P2P" button

### APPEAL / DISPUTE FLOW

Triggered by either party clicking "Raise Appeal":
- Reason selection (radio buttons):
  - I have paid but seller hasn't released
  - Seller is asking for extra fees
  - Seller is unresponsive
  - I made a wrong payment
  - Other
- Evidence upload: image attachment (max 3 screenshots, 5MB each)
- Description textarea (0/500 chars)
- "Submit Appeal" button
- After submission: status changes to "Appeal" badge
- Admin reviews appeal in admin panel
- Both parties notified of admin decision via in-app + email notification

---

## SCREEN 8 — PROFILE PAGE

Route: `/profile`

### Header
- Back arrow (left)
- Share icon (right)

### User Section
- Large avatar circle (initials, grey background, 60px)
- Username (bold, large) + ✏️ edit icon
- "Verified user" label (green) OR "Unverified" (grey)
- Verification badges row:
  - ✅ Email · ✅ SMS · ✅ KYC · ✅ Address
  - Grey if not verified, green if verified

### Stats Card (dark inner card)
- 2×2 grid:
  - 30d Trades | 30d Completion Rate
  - Avg. Release Time | Avg. Pay Time
- "More ▼" expand → reveals:
  - All Trades total
  - Positive Feedback %
  - Negative Feedback %
  - First trade date

### Tabs
- Trade · Notifications · Others (yellow underline on active)

### Trade Tab Menu Items (each row has → right arrow)
- 👍 Received Feedback (count badge)
- 🔗 Payment Method(s) (count badge)
- 🔒 Restrictions Removal Center
- ➕ Follows
- 🚫 Blocked Users
- 📤 Ad Sharing Code
- 👁️ Recently Viewed

### Payment Methods Page (`/profile/payment-methods`)
- List of added payment methods
- Each method: icon + name + account number + account name + delete button
- "+ Add Payment Method" button
- Add method form:
  - Select type: CBE / Telebirr / Awash / Dashen / Abyssinia / HelloCash / M-Pesa
  - Account name input
  - Account number input
  - Save button

### Notifications Tab
Toggle settings:
- Trade alerts (order created, payment, release)
- Chat message notifications
- System notifications
- Email notifications
- SMS notifications

### Others Tab
- Language (English default)
- Help Center → `/help`
- About
- Logout button (red text)

---

## SCREEN 9 — KYC FLOW

Route: `/kyc`

### Progress Bar (3 steps)
- Step 1: Basic Info
- Step 2: Document Upload
- Step 3: Face Verification

---

### STEP 1 — Basic Info + ID Type Selection

Fields (floating label + icon inputs):
1. Full Legal Name — text input
2. Date of Birth — date picker
3. Nationality — searchable country dropdown with flag
4. ID Type — 4 card buttons (tap to select):
   - 🪪 National ID (Fayda)
   - 📘 Passport
   - 🚗 Driver's License
   - 🪪 Kebele ID
   - Selected card: neon cyan border glow
   - Unselected: dark with white border

Validation: all fields required
"Next" button → `.submit-button` style

---

### STEP 2 — Document Upload

Upload zones change by ID type:

- National ID / Driver's License / Kebele ID → 3 zones:
  - Front of ID
  - Back of ID
  - Selfie holding ID

- Passport → 2 zones:
  - Photo page
  - Selfie holding Passport

Each upload zone:
- Dashed neon cyan border box
- Upload icon + "Tap to upload or drag & drop"
- Preview thumbnail after selection
- Accepts: JPG, PNG, PDF — max 5MB
- Red error if file exceeds 5MB

Back button → returns to Step 1 (data preserved)
"Next" button → Step 3

---

### STEP 3 — Live Face Verification (WebRTC)

**Camera Permission Screen:**
- Camera icon (neon cyan)
- Title: "Face Verification"
- Instructions:
  - ✅ Make sure your face is well lit
  - ✅ Remove glasses or hat
  - ✅ Look directly at the camera
  - ✅ Keep your face inside the oval frame
- "Start Camera" button → requests `getUserMedia` permission
- If denied: "Camera access required. Please allow in browser settings."

**Live Camera View:**
- Front camera: `getUserMedia({ video: { facingMode: 'user' } })`
- Video inside neon cyan oval frame (pulsing glow animation)
- Dark overlay outside oval

**4 Liveness Steps (sequential, auto-advance after 1.5s each):**

| Step | Instruction | Detection Method |
|---|---|---|
| A | "Position your face inside the frame" | Face centered via FaceMesh |
| B | "Slowly turn your head to the left" 👈 | Nose tip vs face center landmark |
| C | "Slowly turn your head to the right" 👉 | Nose tip vs face center landmark |
| D | "Blink naturally" 👁️ | Eye Aspect Ratio (EAR) |

- Animated arrow/icon per step
- ✅ Neon cyan checkmark on success
- 4 dot progress indicator at bottom
- TensorFlow.js + MediaPipe FaceMesh via CDN
- Detection on `requestAnimationFrame` loop

**Timeout & Retry:**
- 30 second timeout per step
- Timeout → "Verification timed out. Please try again." + Retry button
- Max 3 attempts → "Too many failed attempts. Please contact support."

**After All 4 Steps Pass:**
- Stop camera stream immediately
- No photos/video stored client-side
- Show ⏳ "Verification Under Review" screen:
  - Animated neon cyan spinner
  - "Your documents have been submitted. Our team will review within 24 hours."
  - "Go to Dashboard" button → `/wallet`

---

### KYC STATUS BADGES

| Status | Color |
|---|---|
| ⏳ Pending | Yellow |
| ✅ Verified | Neon Cyan/Green |
| ❌ Rejected | Red |
| 🔄 More Info Required | Orange |

---

## SCREEN 10 — ADMIN KYC PANEL

Route: `/admin/kyc` — protected, admin login required

### KYC Submissions Table
Columns: User ID · Username · Full Name · Country · ID Type · Submitted At · Status badge · "Review" button
Filterable tabs: All / Pending / Approved / Rejected / More Info

### KYC Detail View (`/admin/kyc/:userId`)

**Left panel — Submitted data:**
- Full Legal Name
- Date of Birth
- Nationality + ID Type
- Document images (Front / Back / Selfie) — click to enlarge in lightbox
- Liveness result per step (✅ Passed / ❌ Failed)
- Submission timestamp

**Right panel — Admin actions:**

✅ Approve:
- Confirm dialog
- Sets status → `verified`
- Triggers email + in-app notification

❌ Reject:
- Reason dropdown:
  - Document unclear/blurry
  - Document expired
  - Name mismatch
  - Face does not match document
  - Fake/edited document suspected
  - Other (free text)
- Sets status → `rejected`
- Reason shown to user
- Triggers email + in-app notification

🔄 Request More Info:
- Free text input for instruction
- Sets status → `more_info_required`
- Message shown to user
- Triggers email + in-app notification

---

### USER NOTIFICATIONS (Email + In-App)

✅ Approved:
- Email: "Your identity has been verified ✅"
- In-app: green banner "KYC Approved — You can now trade"

❌ Rejected:
- Email: "KYC Verification Failed ❌" + reason
- In-app: red banner + reason + "Resubmit KYC" button
- User resubmits → data cleared, starts from Step 1

🔄 More Info Required:
- Email: "Action Required — Additional Information Needed" + admin message
- In-app: orange banner + message + "Update Submission" button
- User updates only requested items — other fields locked

---

## DATABASE SCHEMA

```sql
-- Users
users: id, username, email, phone, country, kyc_status(pending/verified/rejected/more_info_required), created_at

-- Wallets
wallets: id, user_id, asset(USDT), available_balance, frozen_balance, updated_at

-- Transactions
transactions: id, user_id, type(deposit/withdraw/transfer), amount, network(TRC20/ERC20), status(pending/completed/failed), txid, address, fee, created_at

-- Ads
ads: id, user_id, type(buy/sell), asset(USDT), fiat(ETB), price_type(fixed/floating), price, floating_margin, total_amount, min_limit, max_limit, payment_methods(JSON), payment_time_limit, auto_reply, conditions(JSON), region, status(online/offline/private), created_at

-- Orders
orders: id, ad_id, buyer_id, seller_id, amount_usdt, amount_etb, price, payment_method, status(unpaid/paid/completed/cancelled/appeal), cancel_reason, created_at, paid_at, completed_at

-- Messages
messages: id, order_id, sender_id, receiver_id, content, type(text/image), is_read, created_at

-- Payment Methods
payment_methods: id, user_id, type(CBE/Telebirr/Awash/Dashen/Abyssinia/HelloCash/MPesa), account_number, account_name, created_at

-- Feedback
feedback: id, order_id, from_user_id, to_user_id, type(positive/negative), comment, created_at

-- KYC Submissions
kyc_submissions: id, user_id, full_name, date_of_birth, nationality, id_type, front_image_url, back_image_url, selfie_url, liveness_result(JSON), status, rejection_reason, admin_message, reviewed_by, submitted_at, reviewed_at

-- Appeals
appeals: id, order_id, raised_by, reason, description, evidence_urls(JSON), status(pending/resolved), admin_decision, created_at, resolved_at

-- Notifications
notifications: id, user_id, type, title, message, is_read, created_at
```

---

## FUTURE UPGRADES (add as code comments)

```javascript
// TODO: Auth pages — Login/Register using AuthScreen.zip style (added later)
// TODO: Auto face-match KYC — AWS Rekognition / Azure Face API
// TODO: OCR — extract name from ID, match with submitted full name
// TODO: Liveness AI score — replace manual review with confidence score >95%
// TODO: Watchlist screening — Chainalysis / ComplyAdvantage
// TODO: Push notifications — Firebase FCM
// TODO: 2FA — Google Authenticator / SMS OTP
// TODO: Express trading mode
// TODO: Merchant verification system
// TODO: Admin dashboard analytics
```

---

## COMPLETE SCREEN MAP

| Route | Screen | Status |
|---|---|---|
| `/wallet` | Wallet (landing) | Build now |
| `/p2p` | P2P Marketplace | Build now |
| `/ads` | My Ads List | Build now |
| `/ads/post` | Post Ad (3-step) | Build now |
| `/orders` | Order History | Build now |
| `/trade/:id` | Trade Order Flow | Build now |
| `/chat` | P2P Messages | Build now |
| `/profile` | Profile Page | Build now |
| `/profile/payment-methods` | Payment Methods | Build now |
| `/kyc` | KYC Flow | Build now |
| `/admin/kyc` | Admin KYC Panel | Build now |
| `/auth` | Login / Register | Add LATER with AuthScreen.zip |
