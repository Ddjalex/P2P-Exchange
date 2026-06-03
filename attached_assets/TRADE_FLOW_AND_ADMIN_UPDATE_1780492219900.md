# Complete Trade Flow + Admin Update
## Based on MEXC P2P Reference Screenshots

---

## PART 1 — COMPLETE TRADE FLOW UPDATE (User Side)

Update `artifacts/p2p-exchange/src/pages/trade.tsx` and related pages to exactly match MEXC flow.

---

### STEP 1 — BUY ORDER CONFIRMATION SCREEN
**Before order is created (on P2P marketplace after tapping "Buy USDT")**

Route: shown as bottom sheet or new page from `/p2p`

Layout:
- Back arrow top left
- Amount input field:
  - Label: ETB amount input with × clear button + "Max" button (cyan) + "ETB" currency badge
  - Below: "Limit Br X,XXX.XX–BrX... | Payment Time Limit X..."
- "Received" section:
  - Shows calculated USDT: e.g. "100.0056" + × clear + USDT badge
- Payment Method section:
  - Shows selected payment method with colored indicator dot (e.g. red dot for Tele Birr)
- Seller Information section:
  - Seller Nickname (bold) + "Trust & Fast" badge + "Online" green label
  - 30D Transactions: 1,753
  - 30D Completion Rate: 98.00%
  - Good Review Rate: 97.52%
  - Avg. Release Time: 4 min(s)
  - Registration Date: YYYY-MM-DD
- Advertiser Terms section:
  - Shows seller's auto-reply/terms text
- Bottom: "Buy USDT" large GREEN button (full width, rounded pill)

---

### STEP 2 — ORDER CREATED SCREEN
**Immediately after buyer confirms order**

Route: `/trade/:orderId`

Header:
- Back arrow (left)
- "Cancel Order" text button (top right, muted grey)

Content:
- Title: "Order Created" (large bold white)
- Subtitle: "Pay within XX:XX" — countdown timer in NEON CYAN, counting down from payment time limit
- Seller card (dark rounded card):
  - Avatar circle with initial letter
  - Seller username (bold)
  - Seller KYC full name (muted, smaller)
  - "Chat" button (blue pill, right side)
- "Buy USDT" label (Buy = green, Sell = red)
- Order details list:
  - Amount: XX,XXX ETB + 📋 copy icon
  - Price: XXX.XX ETB
  - Quantity: XXX.XXXX USDT
  - Payment Method: [dot indicator] [method name]
  - Order No.: [long ID] + 📋 copy icon
  - Order Time: YYYY-MM-DD HH:MM:SS
- Bottom: "Pay" large BLUE button (full width, rounded pill)

**IMPORTANT: When "Pay" is tapped → show Payment Instructions screen (Step 3)**

---

### STEP 3 — PAYMENT INSTRUCTIONS SCREEN

Header:
- Back arrow
- "Cancel Order" top right (only available in first 15 min)

Content:
- Title: "Please pay the seller" (large bold white)
- "Chat" button (blue pill, top right of title area)
- Countdown: "Order will be cancelled in XX:XX" (cyan countdown)

Step 1 card (numbered blue circle):
- "Transfer Now" label + Payment method name (right, e.g. "Tele Birr")
- Dark inner card:
  - KYC Name: [seller full name] + 📋 copy
  - Amount: [XX,XXX ETB] (bold) + 📋 copy
  - Phone Number / Account: [number or agent code] + 📋 copy

Step 2 text:
- "After paying, click the button below to notify the seller"

P2P Trading Tips (muted text):
- "1. Always communicate via the platform. Do not use third-party platforms."
- "2. If you have already paid, do not cancel the order. If the other party asks to cancel, please file an appeal."

Bottom center text (muted): "Click the button below to notify the seller to release the crypto"

Bottom: "I have paid" large BLUE button

**When "I have paid" is tapped → show Payment Confirmation dialog (Step 4)**

---

### STEP 4 — PAYMENT CONFIRMATION DIALOG (Bottom Sheet)

- Title: "Payment Confirmation"
- × close button top right
- Warning text: "Clicking [Confirm] without making payment may put your account at risk."
- Summary card:
  - Payment method dot + name
  - Amount: [XX,XXX ETB] in CYAN (bold large)
  - KYC Name: [name] + 📋 copy
  - Phone Number: [number/code] + 📋 copy
- Two buttons side by side:
  - "No" (grey outline, left)
  - "Confirm" (blue filled, right)

**On Confirm → status changes to "paid" → show Waiting for Release screen (Step 5)**

---

### STEP 5 — WAITING FOR SELLER TO RELEASE

Header:
- Back arrow
- "Cancel Order" (now disabled/greyed once paid — cannot cancel after paying)

Content:
- Title: "Waiting for seller to release" (large bold white)
- Subtitle: "Waiting for seller to confirm receipt" (muted)
- Seller card + "Chat" button
- "Buy USDT" label
- Order details:
  - KYC Name: [seller name]
  - Amount: [ETB] + 📋 copy
  - Price: [ETB]
  - Quantity: [USDT]
  - Payment Method: dot + name
  - Order No.: [ID] + 📋 copy
  - Order Time: [timestamp]

Bottom:
- "Appeal (XX:XX)" button — GREYED OUT / disabled initially
- Becomes ACTIVE (orange/red outline button) after appeal timer expires (usually 15-30 min after payment confirmed)
- Appeal countdown shows remaining time before appeal is available

---

### STEP 5B — PLATFORM NOTICE MODAL
**Show once when order transitions to "paid" status (in the chat view)**

- Dark overlay modal
- Orange circle with ! warning icon
- Title: "Platform Notice"
- Body:
  - "1. Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes."
  - "2. The crypto in this order has been locked, and your order is securely protected."
- "Got It" blue button → dismisses modal, stores flag so it only shows once per order

---

### STEP 5C — TRADE CHAT SCREEN (during active order)

Route: `/chat/:orderId`

Header:
- Back arrow
- Seller/Buyer name (bold center)
- "Online/Inactive | [KYC Full Name]" (muted subtitle)
- Headphone/support icon (right)

Status bar (sticky, below header):
- "Order Created / Waiting for payment"
- "Please transfer [X,XXX ETB] within [countdown]" 
- "Pay" or "I have paid" button (right, matches current status)

Warning banner (orange):
- "⚠ Please do not use third-party platforms for communication, as ex..."
- Arrow ">" to expand

Auto-reply message (dark card bubble, left aligned):
- Seller's auto-reply text shown automatically when order created

System messages (centered, grey):
- "Your order has been created. Please complete the payment promptly."
- "Buyer has marked payment as sent." (when paid)
- "Seller has released the crypto." (when complete)

Message bubbles:
- Sent (right): primary color background
- Received (left): dark card background

Bottom input:
- "Enter your chat here." placeholder
- "+" button for attachments (image upload, max 5MB)
- Send button

---

### STEP 6 — ORDER COMPLETE SCREEN

Full screen success view:
- Large GREEN circle with ✓ checkmark (animated)
- Amount: "[XXX.XXXX USDT]" (large bold)
- Subtitle: "Deposit to your wallet"

"Earn More" section (optional promo card):
- "Earn" label
- "15% APR" (bold)
- "Stake Now" button

"Rate your counterparty" text (muted, centered)

Two buttons:
- "Complete" (blue filled, full width) → goes to wallet page
- "View Assets" (outline, full width) → goes to wallet page

---

### WALLET FREEZE LOGIC (CRITICAL)

**When an order is created (status = unpaid):**
- Seller's USDT is immediately FROZEN (moved from available to frozen balance)
- Seller cannot withdraw or use frozen USDT
- Wallet shows: Available: X USDT | Frozen: Y USDT

**When order completes (status = completed):**
- Frozen USDT is released to buyer's available balance
- Seller's frozen balance decreases by order amount

**When order is cancelled:**
- Frozen USDT returned to seller's available balance

**When appeal is raised:**
- USDT stays frozen until admin resolves dispute
- Admin can: Release to buyer OR Return to seller

---

### ORDER STATUS FLOW

```
unpaid → paid → completed
   ↓              ↓
cancelled      appeal_raised → admin_resolved (completed OR cancelled)
```

Status badges in Order History:
- unpaid → yellow "Unpaid"
- paid → blue "Paid"  
- completed → green "Completed"
- cancelled → grey "Cancelled"
- appeal → red "Under Appeal"

---

### ORDER HISTORY SCREEN UPDATE

Route: `/orders`

Tabs: **Open Orders** | **Ended** (not "Ongoing/Fulfilled")

Open Orders sub-filters: All | Unpaid | Paid | Under Appeal
Ended sub-filters: All | Completed | Cancelled | Under Appeal

Each order card:
- "Buy USDT" (green) or "Sell USDT" (red) + date (top left)
- Status badge + ">" arrow (top right) — tap to open order detail
- Amount: Br XX,XXX (bold)
- Price: Br XXX.XX
- Quantity: XXX.XXXX USDT
- Trader name + chat bubble icon (bottom right)

---

## PART 2 — ADMIN DASHBOARD UPDATES

### ADMIN TRADE MONITORING

The admin can see and control the entire trade flow.

**Admin Order Detail page (`/admin/orders/:id`) additions:**

**USDT Freeze Status:**
- Show clearly: "USDT Status: FROZEN" (red badge) or "Released" (green)
- Amount frozen: X USDT
- Frozen since: [timestamp]

**Order Timeline (visual vertical line):**
- ✅ Order Created — [timestamp]
- ✅ Payment Marked by Buyer — [timestamp]  
- ⏳ Waiting for Seller Release — [countdown]
- ❌/✅ Completed / Cancelled / Appealed — [timestamp]

**Chat History:**
- Full conversation between buyer and seller viewable by admin
- System messages shown in grey
- Admin can read all messages as evidence

**Admin Actions on Active Orders:**

🔓 Force Release (Release USDT to buyer)
- Use when: seller is unresponsive after buyer paid
- Confirm dialog: "Are you sure? This will release X USDT to the buyer."
- Logs to admin_logs

🔒 Force Cancel (Return USDT to seller)
- Use when: buyer did not actually pay
- Confirm dialog with reason input
- Logs to admin_logs

⚠️ Flag Order (mark for review)
📝 Add Admin Note (internal note, not shown to users)

---

### ADMIN DISPUTE/APPEAL MANAGEMENT UPDATE

**Appeal Detail page (`/admin/disputes/:id`) — exact MEXC-style flow:**

**Evidence Panel:**
- Reason selected by user (from preset list)
- Description text
- Uploaded evidence screenshots (lightbox on click)
- Full order chat history (read-only)
- Order timeline

**Both Parties Info:**
- Buyer: name, KYC status, trade history, did they mark paid?
- Seller: name, KYC status, trade history, did they release?

**USDT Status:**
- "X USDT currently FROZEN — awaiting admin decision"

**Admin Decision:**
- Radio: "Release to Buyer" | "Return to Seller"
- Reason textarea (shown to both parties)
- "Resolve Dispute" button

**After Resolution:**
- USDT unfrozen and moved to winner
- Both parties notified (email + in-app)
- Order status → completed (if buyer wins) or cancelled (if seller wins)
- Loser can be flagged for review

---

### ADMIN USER BLOCKING/SUSPENSION

**Trigger: Fraudulent behaviour during trade**

Admin can from User Detail page (`/admin/users/:id`):

**Suspend User:**
- Reason dropdown:
  - Fraudulent payment claim
  - Non-payment after order created  
  - Abusive behaviour in chat
  - Multiple appeals lost
  - Fake KYC documents
  - Other (free text)
- Duration: Temporary (1/3/7/30 days) | Permanent
- "Suspend" button → confirm dialog

**Effects of Suspension:**
- User cannot create new orders
- User cannot post new ads
- User cannot deposit or withdraw
- User can still VIEW the platform (read-only)
- All active orders of suspended user → auto-cancelled (USDT returned)
- User sees: "Your account has been suspended. Reason: [reason]. Contact support at support@ethiop2p.com"

**Unsuspend User:**
- Shows suspension reason + date
- "Lift Suspension" button
- Optional note to user

**Auto-flag triggers (show warning badge to admin, not auto-suspend):**
- User loses 3+ appeals in 30 days
- User cancels 5+ orders in 7 days  
- User receives 3+ negative feedback in 30 days
- User's completion rate drops below 70%

---

### ADMIN FRAUD DETECTION PANEL

Route: `/admin/fraud`

**Flagged Users table:**
- User | Flag Reason | Count | Last Flagged | Action
- Filter by flag type

**Appeal Loss Tracker:**
- Users who lost appeals: name, count lost, last lost date, view history

**Cancellation Rate Monitor:**
- Users with high cancellation rates highlighted in orange/red

---

### COMPLETE UPDATED ADMIN SIDEBAR

```
📊 Dashboard
👥 Users
   └─ All Users
   └─ Flagged Users
   └─ Suspended Users
✅ KYC Verification
📢 Ads Management
📋 Orders & Trades
   └─ All Orders
   └─ Active Orders
   └─ Frozen USDT
⚖️ Disputes & Appeals
🚨 Fraud Detection
💰 Wallet & Transactions
   └─ Platform Wallet
   └─ Pending Withdrawals
   └─ Frozen Balances
💬 Messages Monitor
🔔 Notifications
⚙️ System Settings
💵 Fee Management
📜 Audit Logs
🚪 Logout
```

---

## PART 3 — DATABASE UPDATES NEEDED

```sql
-- Add to orders table:
ALTER TABLE orders ADD COLUMN frozen_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN released_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN appeal_available_at TIMESTAMP; -- when appeal button becomes active
ALTER TABLE orders ADD COLUMN admin_note TEXT;
ALTER TABLE orders ADD COLUMN admin_resolved_by INT; -- admin_id

-- Add to users table:
ALTER TABLE users ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;
ALTER TABLE users ADD COLUMN suspended_until TIMESTAMP; -- NULL = permanent
ALTER TABLE users ADD COLUMN suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN flag_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN cancellation_count_7d INT DEFAULT 0;
ALTER TABLE users ADD COLUMN appeal_loss_count_30d INT DEFAULT 0;

-- Fraud flags table
CREATE TABLE fraud_flags (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  flag_type VARCHAR(50), -- 'appeal_loss' | 'high_cancellation' | 'negative_feedback' | 'manual'
  description TEXT,
  flagged_by VARCHAR(50), -- 'system' | 'admin'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## PART 4 — API ENDPOINTS NEEDED

```
# Trade Flow
POST /api/orders/:id/mark-paid        → buyer marks payment sent
POST /api/orders/:id/release          → seller releases crypto  
POST /api/orders/:id/cancel           → cancel order
POST /api/orders/:id/appeal           → raise dispute
GET  /api/orders/:id/chat             → get chat messages
POST /api/orders/:id/chat             → send message
GET  /api/orders/:id/payment-details  → get seller payment info

# Admin Trade Control  
POST /api/admin/orders/:id/force-release   → admin forces USDT to buyer
POST /api/admin/orders/:id/force-cancel    → admin returns USDT to seller
POST /api/admin/orders/:id/add-note        → admin internal note
GET  /api/admin/orders/:id/chat            → view order chat history

# Admin User Control
POST /api/admin/users/:id/suspend          → suspend user
POST /api/admin/users/:id/unsuspend        → lift suspension
POST /api/admin/users/:id/flag             → manual flag

# Admin Disputes
GET  /api/admin/disputes                   → list all appeals
GET  /api/admin/disputes/:id               → get appeal detail with evidence
POST /api/admin/disputes/:id/resolve       → resolve appeal (buyer/seller wins)

# Fraud Detection
GET  /api/admin/fraud/flagged-users        → list flagged users
GET  /api/admin/fraud/high-cancellations   → users with high cancellation rate
GET  /api/admin/fraud/appeal-losses        → users who lost multiple appeals
```

---

## PART 5 — SECURITY & SAFETY MESSAGES

These exact messages must appear in the UI:

**In order chat (sticky warning banner):**
> "⚠️ Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes."

**Platform Notice modal (shown once per order when status → paid):**
> "Follow the guidelines below to trade safely and reduce the risk of asset loss:
> 1. Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes.
> 2. The crypto in this order has been locked, and your order is securely protected."

**Payment confirmation warning:**
> "Clicking [Confirm] without making payment may put your account at risk."

**P2P Trading Tips (on payment instructions screen):**
> "1. Always communicate via the platform. Do not use third-party platforms.
> 2. If you have already paid, do not cancel the order. If the other party asks to cancel, please file an appeal."

**Suspended user message:**
> "Your account has been suspended. Reason: [reason]. If you believe this is a mistake, contact support@ethiop2p.com"

