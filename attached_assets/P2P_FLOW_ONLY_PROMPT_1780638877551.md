# EthioP2P — P2P FLOW ONLY
# Replit already has: Auth, KYC, Deposit/Withdraw, Admin Dashboard
# THIS PROMPT: Fix and complete the P2P trading flow ONLY
# Reference: MEXC P2P app (www.mexc.com/p2p)
# Paste this into Replit AI

---

## WHAT REPLIT ALREADY HAS (DO NOT TOUCH)
- ✅ Auth system (login/register/JWT)
- ✅ KYC flow (document upload + face verification)
- ✅ Deposit/Withdraw wallet system
- ✅ Admin dashboard
- ✅ Database + user/wallet tables

## WHAT NEEDS TO BE BUILT/FIXED NOW
Only these routes and their full logic:
- `/p2p` — marketplace
- `/ads` — my ads list
- `/ads/post` — post ad wizard
- `/orders` — order history
- `/trade/:id` — complete order flow
- `/chat/:orderId` — order chat

---

## HOW MEXC P2P WORKS (read this first)

MEXC P2P works exactly like this:
1. Users post BUY or SELL ads on the marketplace
2. Another user taps the ad and enters an amount
3. The moment order is created → seller's USDT is LOCKED IN ESCROW automatically
4. Buyer pays seller directly via bank/mobile money (CBE, Telebirr, etc.)
5. Buyer taps "I have paid" → seller is notified
6. Seller confirms payment received in their account → taps "Release Crypto"
7. USDT is released from escrow → deposited into buyer's wallet instantly
8. If seller does not release → buyer can raise an Appeal after timer expires
9. Admin reviews appeal → decides who gets the USDT
10. Zero trading fees on P2P

Build EthioP2P P2P flow EXACTLY like this.

---

## PART 1 — DATABASE ADDITIONS

Add these columns/tables if they don't already exist:

```sql
-- Add to ads table if missing:
ALTER TABLE ads ADD COLUMN IF NOT EXISTS available_amount DECIMAL(20,8);
ALTER TABLE ads ADD COLUMN IF NOT EXISTS price_type VARCHAR(10) DEFAULT 'fixed';
ALTER TABLE ads ADD COLUMN IF NOT EXISTS floating_margin DECIMAL(5,2);
ALTER TABLE ads ADD COLUMN IF NOT EXISTS auto_reply TEXT;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}';
ALTER TABLE ads ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'all';
ALTER TABLE ads ADD COLUMN IF NOT EXISTS payment_time_limit INTEGER DEFAULT 15;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS completed_trades INTEGER DEFAULT 0;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add to orders table if missing:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_no VARCHAR(50) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS appeal_available_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS released_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Messages table (if not exists)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  sender_id INTEGER,       -- NULL = system message
  receiver_id INTEGER,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  -- text | image | system | auto_reply
  image_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feedback table (if not exists)
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  from_user_id INTEGER,
  to_user_id INTEGER,
  type VARCHAR(20) NOT NULL,  -- positive | negative
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Appeals table (if not exists)
CREATE TABLE IF NOT EXISTS appeals (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  raised_by INTEGER,
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  evidence_urls JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending',  -- pending | resolved
  admin_decision VARCHAR(20),  -- buyer_wins | seller_wins
  admin_note TEXT,
  resolved_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

---

## PART 2 — BACKEND API ROUTES

Add/fix these routes. Keep all existing routes untouched.

### 2A — ADS ROUTES

**GET /api/ads** (public, with filters)
```typescript
// Query params:
// type: 'buy' | 'sell'
// status: 'online' (default for marketplace)
// paymentMethod: filter by method
// minAmount: filter ads where minLimit <= amount
// maxAmount: filter ads where maxLimit >= amount

// For BUY tab in marketplace: fetch type='sell' ads (sellers selling USDT)
// For SELL tab in marketplace: fetch type='buy' ads (buyers buying USDT)

// Each ad includes:
// - advertiser username, total_trades, completion_rate from users table
// - available_amount, price, limits, payment_methods

// Filter OUT logged-in user's own ads
// Sort: BUY tab → price ASC (cheapest seller first)
//       SELL tab → price DESC (highest buyer first)
// Paginate: 20 per page

// Return: { ads: [...], total, page }
```

**POST /api/ads** (authenticated)
```typescript
// Body: { type, priceType, price, floatingMargin, totalAmount,
//         minLimit, maxLimit, paymentMethods, paymentTimeLimit,
//         autoReply, conditions, region, status }

// Validate: all required fields present
// Validate: minLimit < maxLimit
// Validate: totalAmount > 0
// If type='sell': check user available_balance >= totalAmount
// If type='sell': freeze totalAmount in wallet:
//   available_balance -= totalAmount
//   frozen_balance += totalAmount
// Set available_amount = totalAmount
// Generate order_no prefix for future orders
// Insert ad → return new ad
```

**PATCH /api/ads/:id** (authenticated, owner only)
```typescript
// Can update: price, floatingMargin, autoReply, conditions, region, status
// status: 'online' | 'offline' | 'private'
// If status → offline: ad disappears from marketplace immediately
// Cannot change type/asset/fiat if active orders exist
// Update updated_at = NOW()
```

**DELETE /api/ads/:id** (authenticated, owner only)
```typescript
// Only if no active orders (status: unpaid or paid)
// If type='sell': unfreeze available_amount back to wallet
// Delete or soft-delete ad
```

---

### 2B — ORDERS ROUTES

**POST /api/orders** (authenticated) — MOST IMPORTANT FIX
```typescript
// This is currently broken — fix completely

app.post('/api/orders', authenticate, async (req, res) => {
  const { adId, amountEtb, paymentMethod } = req.body;

  try {
    // Use database transaction — everything or nothing
    const result = await db.transaction(async (tx) => {

      // Step 1: Get the ad
      const ad = await tx.query.ads.findFirst({
        where: eq(ads.id, adId)
      });
      if (!ad) {
        throw { status: 404, message: 'Advertisement not found' };
      }
      if (ad.status !== 'online') {
        throw { status: 400, message: 'This ad is no longer available' };
      }
      if (ad.userId === req.user.id) {
        throw { status: 400, message: 'Cannot trade your own advertisement' };
      }

      // Step 2: Validate user
      if (req.user.kycStatus !== 'verified') {
        throw { status: 403, message: 'Complete KYC verification to start trading' };
      }

      // Step 3: Validate amount
      if (amountEtb < ad.minLimit) {
        throw { status: 400, message: `Minimum order amount is Br ${Number(ad.minLimit).toLocaleString()}` };
      }
      if (amountEtb > ad.maxLimit) {
        throw { status: 400, message: `Maximum order amount is Br ${Number(ad.maxLimit).toLocaleString()}` };
      }
      if (!paymentMethod) {
        throw { status: 400, message: 'Please select a payment method' };
      }
      if (!ad.paymentMethods.includes(paymentMethod)) {
        throw { status: 400, message: 'Invalid payment method for this ad' };
      }

      // Step 4: Calculate USDT amount
      const usdtAmount = parseFloat((amountEtb / ad.price).toFixed(8));
      if (usdtAmount > ad.availableAmount) {
        throw { status: 400, message: 'Insufficient ad balance. Please reduce your amount.' };
      }

      // Step 5: Verify seller wallet has enough
      const sellerWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, ad.userId)
      });
      if (!sellerWallet || sellerWallet.availableBalance < usdtAmount) {
        throw { status: 400, message: 'Seller has insufficient balance' };
      }

      // Step 6: LOCK seller USDT in escrow
      await tx.update(wallets)
        .set({
          availableBalance: sql`available_balance - ${usdtAmount}`,
          frozenBalance: sql`frozen_balance + ${usdtAmount}`
        })
        .where(eq(wallets.userId, ad.userId));

      // Step 7: Generate unique order number (MEXC format)
      const orderNo = `d${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Step 8: Set appeal available time (payment limit + 30 min buffer)
      const appealAvailableAt = new Date(
        Date.now() + (ad.paymentTimeLimit + 30) * 60 * 1000
      );

      // Step 9: Create the order
      const buyerId = ad.type === 'sell' ? req.user.id : ad.userId;
      const sellerId = ad.type === 'sell' ? ad.userId : req.user.id;

      const [order] = await tx.insert(orders).values({
        orderNo,
        adId: ad.id,
        buyerId,
        sellerId,
        amountUsdt: usdtAmount,
        amountEtb,
        price: ad.price,
        paymentMethod,
        status: 'unpaid',
        appealAvailableAt,
        frozenAt: new Date(),
        createdAt: new Date()
      }).returning();

      // Step 10: Reduce ad available amount
      await tx.update(ads)
        .set({
          availableAmount: sql`available_amount - ${usdtAmount}`
        })
        .where(eq(ads.id, ad.id));

      // Step 11: Send auto-reply if seller set one
      if (ad.autoReply) {
        await tx.insert(messages).values({
          orderId: order.id,
          senderId: ad.userId,
          receiverId: req.user.id,
          content: ad.autoReply,
          type: 'auto_reply',
          createdAt: new Date()
        });
      }

      // Step 12: System message
      await tx.insert(messages).values({
        orderId: order.id,
        senderId: null,
        content: 'Your order has been created. Please complete the payment promptly.',
        type: 'system',
        createdAt: new Date()
      });

      // Step 13: Notify seller
      await tx.insert(notifications).values({
        userId: sellerId,
        type: 'order_created',
        title: 'New Order',
        message: `New order for ${usdtAmount} USDT (Br ${amountEtb.toLocaleString()})`,
        relatedOrderId: order.id,
        createdAt: new Date()
      });

      return order;
    });

    return res.status(201).json({ order: result });

  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Order creation error:', err);
    return res.status(500).json({ message: 'Order creation failed. Please try again.' });
  }
});
```

**PATCH /api/orders/:id/mark-paid** (authenticated, buyer only)
```typescript
// Validate: status === 'unpaid', req.user.id === order.buyerId
// Update: status = 'paid', paid_at = NOW()
// Add system message: 'Buyer has marked payment as sent.'
// Notify seller: "Buyer has marked payment as sent. Please verify and release."
// Return updated order
```

**PATCH /api/orders/:id/release** (authenticated, seller only)
```typescript
// Validate: status === 'paid', req.user.id === order.sellerId
// DB Transaction:
//   1. seller frozen_balance -= amountUsdt
//   2. buyer available_balance += amountUsdt
//   3. order status = 'completed', released_at = completed_at = NOW()
//   4. Create transaction records for both buyer + seller
//   5. Update both users' total_trades += 1
//   6. System message: 'Seller has released the crypto. Order completed.'
//   7. Notify buyer: 'X USDT deposited to your wallet'
// Return updated order
```

**PATCH /api/orders/:id/cancel** (authenticated)
```typescript
// Validate: status === 'unpaid'
// Buyer can cancel: only within first 15 min of order creation
// Seller can cancel: anytime while status = unpaid
// DB Transaction:
//   1. seller frozen_balance -= amountUsdt
//   2. seller available_balance += amountUsdt (unfreeze)
//   3. ad available_amount += amountUsdt (restore)
//   4. order status = 'cancelled', cancelled_at = NOW()
//   5. System message: 'Order has been cancelled.'
//   6. Notify counterparty
// Return updated order
```

**POST /api/orders/:id/appeal** (authenticated)
```typescript
// Validate: status === 'paid'
// Validate: new Date() >= order.appealAvailableAt (appeal timer expired)
// Body: { reason, description, evidenceUrls[] }
// Insert into appeals table
// Update order status = 'appeal'
// USDT stays frozen (do NOT unfreeze)
// Notify admin + counterparty
// Return appeal
```

**GET /api/orders/:id** (authenticated, buyer or seller only)
```typescript
// Return order with:
// - buyer info (username, kycName, stats)
// - seller info (username, kycName, stats, paymentMethodDetails)
// - seller's payment method details (account name, account number)
// - ad info (autoReply, advertiserTerms)
// - messages (latest 20)
```

**GET /api/orders/:id/messages** (authenticated, buyer or seller only)
```typescript
// Return all messages for this order
// Sorted by created_at ASC
```

**POST /api/orders/:id/messages** (authenticated, buyer or seller only)
```typescript
// Body: { content, type, imageUrl }
// type: text | image
// Insert message
// Notify receiver
// Return message
```

**GET /api/orders** (authenticated)
```typescript
// Query: status filter, tab (open/ended)
// open = status in ['unpaid', 'paid', 'appeal']
// ended = status in ['completed', 'cancelled']
// Filter by logged-in user (buyer or seller)
// Sort by created_at DESC
// Return with counterparty info
```

---

## PART 3 — FRONTEND SCREENS

### SCREEN 1: P2P MARKETPLACE (/p2p)

**Header:**
```
"Wallet" (tap → /wallet)  "P2P" (bold, active)     [ETB] [🔔]
```

**Buy / Sell toggle:**
```
[  Buy  ] [  Sell  ]  ← pill style, selected = white filled
```
- BUY tab → fetch ads where type='sell' (people selling USDT, user wants to buy)
- SELL tab → fetch ads where type='buy' (people buying USDT, user wants to sell)

**Filter row:**
```
[USDT] [Amount ▼] [Payment ▼] [⚙]
```

**Ad cards** (exact MEXC layout):
```
┌─────────────────────────────────────────┐
│ [T]  Trust & Fast            ● Online  │
│      1,753 orders · 98.00%              │
│                                         │
│  178.00 ETB                   per USDT │
│                                         │
│  Available  562 USDT                   │
│  Limit  Br 3,000 – Br 100,000          │
│                                         │
│  [CBE] [Telebirr] [Awash]              │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │       Buy USDT  (green)           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Real-time refresh:**
```typescript
// Refetch every 30 seconds using React Query
refetchInterval: 30000
```

**Empty state:**
```
[document icon]
No Ads
[Reset filter] button
```

**Tapping "Buy USDT"** → navigate to order confirmation screen

---

### SCREEN 2: ORDER CONFIRMATION

Full page shown before order is created:

```
[←]

┌────────────────────────────────────────┐  ← error banner (red, ONLY if error)
│ ⚠ [exact error message from API]      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ I want to pay                          │
│                                        │
│  17,800          [×] [Max] [ETB]      │
│  Limit Br 3,000 – Br 100,000          │
│  Time Limit 15 min                     │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ I will receive                         │
│                                        │
│  100.0056                    [USDT]   │
│  Price: 178 ETB/USDT                  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Payment Method                         │
│                                        │
│  ● CBE                                │  ← not selected
│ ┌──────────────────────────────────┐  │
│ │ ● Telebirr                  ✓  │  │  ← selected = cyan border + checkmark
│ └──────────────────────────────────┘  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ SELLER INFORMATION                     │
│                                        │
│ [T] Trust & Fast         ● Online     │
│                                        │
│ 30D Transactions         1,753        │
│ 30D Completion Rate      98.00%       │
│ Good Review Rate         97.52%       │
│ Avg. Release Time        4 min(s)     │
│ Registration Date        2025-11-02   │
│                                        │
│ Advertiser Terms                       │
│ "welcome! 1. don't pay 3rd party..."   │
└────────────────────────────────────────┘

[          Buy USDT  (large green)          ]
```

**Logic:**
- USDT = ETB ÷ price (recalculates live as user types)
- Disable "Buy USDT" button while submitting (show spinner)
- On error: show exact API message in red banner at top
- On success: navigate to `/trade/${order.id}`

---

### SCREEN 3: ORDER CREATED (/trade/:id — status: unpaid)

```
[←]                            [Cancel Order]

Order Created
Pay within  14:54  ← CYAN countdown timer

┌────────────────────────────────────────┐
│ [T]  Trust & Fast             [Chat]  │
│      SEID WORKNEH BEYENE               │
└────────────────────────────────────────┘

Buy  USDT

Amount          17,800 ETB        [📋]
Price           177.99 ETB
Quantity        100.0056 USDT
Payment Method  ● Tele Birr
Order No.       d1740202885853463552  [📋]
Order Time      2026-06-02 12:58:00

[              Pay  (blue)               ]
```

**Countdown:** counts from payment_time_limit minutes to 0
**When 0:** PATCH /api/orders/:id/cancel → show "Order Cancelled" state
**[Chat] button:** navigate to /chat/:orderId
**[📋] copy icons:** copy to clipboard + show "Copied!" toast

---

### SCREEN 4: PAYMENT INSTRUCTIONS (after tapping Pay)

```
[←]                            [Cancel Order]

Please pay the seller                  [Chat]
Order will be cancelled in  14:31  ← CYAN

① Transfer Now                  Tele Birr
┌────────────────────────────────────────┐
│ KYC Name    SEID WORKNEH BEYENE  [📋] │
│ Amount      17,800 ETB           [📋] │
│ Phone No.   Telebirr Agent 👉361114[📋]│
└────────────────────────────────────────┘

② After paying, click the button below to
  notify the seller

  P2P Trading Tips
  1. Always communicate via the platform.
     Do not use third-party apps.
  2. If you paid, do NOT cancel. File appeal.

  Click below to notify seller to release crypto.

[           I have paid  (blue)            ]
```

**Seller payment details** come from seller's `payment_methods` table
matching the selected `paymentMethod` on the order

---

### SCREEN 5: PAYMENT CONFIRMATION DIALOG

Bottom sheet when "I have paid" is tapped:

```
Payment Confirmation               [×]

Clicking [Confirm] without making payment
may put your account at risk.

┌────────────────────────────────────────┐
│ ● Tele Birr                           │
│ Amount    17,800 ETB  (CYAN LARGE)    │
│ KYC Name  SEID WORKNEH BEYENE  [📋]  │
│ Phone     Telebirr Agent 👉361114 [📋]│
└────────────────────────────────────────┘

[     No     ]   [     Confirm     ]
```

**On Confirm:** PATCH /api/orders/:id/mark-paid → status = 'paid'

---

### SCREEN 6: WAITING FOR RELEASE (status: paid)

```
[←]                 [Cancel Order — DISABLED]

Waiting for seller to release  –
Waiting for seller to confirm receipt

┌────────────────────────────────────────┐
│ [T]  Trust & Fast             [Chat]  │
│      SEID WORKNEH BEYENE               │
└────────────────────────────────────────┘

Buy  USDT

KYC Name        SEID WORKNEH BEYENE
Amount          17,800 ETB    [📋]
Price           177.99 ETB
Quantity        100.0056 USDT
Payment Method  ● Tele Birr
Order No.       d1740202885853463552  [📋]
Order Time      2026-06-02 12:58:00

[      Appeal (13:12)  ← greyed + countdown      ]
```

**Appeal button:**
- Greyed out while appealAvailableAt has NOT passed
- Shows countdown: "Appeal (13:12)" — minutes remaining
- Turns ORANGE and active when timer expires
- Tapping → appeal screen

**PLATFORM NOTICE MODAL** — show once when status changes to 'paid':
```
[! orange circle]

Platform Notice

Follow the guidelines below to trade safely:

1. Do not use third-party platforms for
   communication, as external chat history
   cannot be used as valid evidence.

2. The crypto in this order has been locked,
   and your order is securely protected.

[              Got It               ]
```
Store in localStorage: `notice_${orderId} = shown`
Never show again for this order.

---

### SCREEN 7: SELLER VIEW (when buyer has paid)

```
[←]

Buyer has marked payment as sent

┌────────────────────────────────────────┐
│ [B]  BuyerUsername            [Chat]  │
└────────────────────────────────────────┘

Sell  USDT
Amount: 17,800 ETB
Payment: ● Tele Birr
Quantity: 100.0056 USDT
Order No: d1740202885853463552

⚠ Only release after confirming payment
  received in your account.

[  Raise Appeal  ]  [  Release Crypto ✓  ]
```

**Release Crypto dialog:**
```
Are you sure you want to release
100.0056 USDT to buyer?

⚠ Only release AFTER confirming:
  • Br 17,800 received in your account
  • Sender name matches KYC name
  • Full amount received — not partial

[  Cancel  ]  [  Confirm Release  ]
```

**On Confirm Release:** PATCH /api/orders/:id/release

---

### SCREEN 8: ORDER CHAT (/chat/:orderId)

```
[←]  Trust & Fast  ● Online             [🎧]
     SEID WORKNEH BEYENE (Inactive)

┌────────────────────────────────────────┐  ← sticky status bar
│ Order Created              [Pay →]    │
│ Transfer 17,800 ETB within  14:36     │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐  ← sticky warning
│ ⚠ Do not use third-party platforms   │
│   for communication...          [>]   │
└────────────────────────────────────────┘

┌──────────────────────────┐   ← auto-reply (left, dark card)
│ Welcome! 🤝              │
│ ወደ agent...             │
│ Cash in/out 👇          │
│ ...                      │
└──────────────────────────┘

    ┌──────────────────────────────────┐
    │ Your order has been created.    │   ← system (centered, grey)
    │ Complete payment promptly.      │
    └──────────────────────────────────┘

                      ┌─────────────────┐
                      │ Hello, I have   │   ← sent (right, cyan)
                      │ paid already    │
                      └─────────────────┘

[  Enter your chat here...         ] [+] [→]
```

**"+" button:** image upload (evidence screenshot, max 5MB)
**Status bar:** updates based on order status
**Action button:** matches current status
- unpaid → "Pay"
- paid → "Waiting..."
- completed → "View Order"

---

### SCREEN 9: ORDER COMPLETED (status: completed)

```
[←]

       ✅  (large green animated checkmark)

       100.0056 USDT
       Deposit to your wallet

Earn More
┌────────────────────────────────────────┐
│ Earn 15% APR              [Stake Now] │
└────────────────────────────────────────┘

       Rate your counterparty

   [👍 Positive]   [👎 Negative]

   (if tapped, show comment box 0/200)
   [Submit Feedback]

[         Complete  (blue)          ]
[         View Assets (outline)     ]
```

**Complete/View Assets** → navigate to /wallet

---

### SCREEN 10: APPEAL SCREEN

```
[←]
Raise Appeal

Order: d1740202885853463552

Select a reason:
◉ I have paid but seller hasn't released
○ Seller is asking for extra fees
○ Seller is unresponsive
○ I made a wrong payment
○ Other

Description:
┌────────────────────────────────────────┐
│                                    0/500│
└────────────────────────────────────────┘

Evidence (up to 3 screenshots, 5MB each):
[+ Upload]  [+ Upload]  [+ Upload]

⚠ Only raise appeal if you have paid.
  Do not raise if you have NOT paid.

[          Submit Appeal           ]
```

**On submit:** POST /api/orders/:id/appeal → order status = 'appeal'

---

### SCREEN 11: ORDER HISTORY (/orders)

**Header:** "Order History"  [📥 export]
**Tabs:** [Open Orders]  [Ended]
**Open sub-filters:** All · Unpaid · Paid · Under Appeal
**Ended sub-filters:** All · Completed · Cancelled · Under Appeal

**Order card:**
```
Buy USDT                        Paid  [>]
2026-06-02 12:58

Amount          Br 17,800
Price           Br 177.99
Quantity        100.0056 USDT

              [💬 Trust & Fast]

─────────────────────────────────────────
```

**Tapping card** → /trade/:id (shows current state)
**💬 Chat** → /chat/:orderId

---

### SCREEN 12: POST AD WIZARD (/ads/post)

**3-step progress bar:**
```
  ①──────────②──────────③
Set Type   Set Amount  Set
& Price    & Method    Conditions
```

**STEP 1 — Set Type & Price:**
```
I want to
[ Buy ]  [ Sell ]

Asset       With Fiat
[ USDT ▼]  [ ETB ▼ ]  ← both locked

Price Type
[ Fixed                        ▼ ]

↓ Bottom sheet for Price Type:
  Fixed ✓ — Constant price, no fluctuations
  Floating — Market price × margin

If Fixed:
[ − ]    178.00    [ + ]
Price range: 89.00 – 356.00
Your Price    178.00 ETB
Highest Order Price  185.00 ETB  ← if Buy
Lowest Ad Price      175.00 ETB  ← if Sell

[            Next             ]
```

**STEP 2 — Set Amount & Method:**
```
Total amount
[ 0.00                  USDT [All] ]
≈ 0.00 ETB
Available: 0.00 USDT  [+]

Order Limit  ⓘ
[ 3000 ETB ] ~  [ 200000 ETB ]
≈ 16.85 USDT      ≈ 1,123 USDT

Payment Method               [+ Add]
Select up to 5 methods.

[ CBE ] [ Telebirr ] [ Awash Bank ]
[ Dashen ] [ Abyssinia ] [ HelloCash ]
[ M-Pesa ]

⚠ Please select at least one method

Payment Time Limit  ⓘ
[ 15 Min                      ▼ ]
Options: 15 Min / 30 Min / 1 Hour

Reserved Fee: 0 USDT

[Previous]           [Next]
```

**STEP 3 — Set Conditions:**
```
Auto-reply (Optional)
┌────────────────────────────────────────┐
│ Message sent to counterparty when     │
│ order is created...             0/1000│
└────────────────────────────────────────┘

Counterparty Conditions
☐ Registered [ 0 ] Day(s) ago
☐ Holdings more than [ 0 ] USDT
☐ Non-merchant

Display to Users In
[ All Region(s)               ▼ ]

Status
● Online
○ Offline
○ Private

[Previous]          [Preview]
```

**PREVIEW BOTTOM SHEET:**
```
Preview Ad

Buy USDT With ETB         [Online]

Price                178.00 ETB
Price Type                Fixed
Total Amount       1,000.00 USDT
Actual Amount        998.00 USDT
Estimated Fee          2.00 USDT
Limit      3,000.00 – 200,000.00 ETB
Payment Methods      CBE · Telebirr
Payment Time Limit      15 Minutes
Display to Users In   All Region(s)

[    Edit    ]   [    Post    ]
```

**On Post:**
1. POST /api/ads
2. If sell type: wallet balance frozen immediately
3. Redirect to /ads list
4. Success toast: "Ad posted successfully!"
5. Ad appears in /p2p marketplace immediately for other users

---

### SCREEN 13: MY ADS (/ads)

```
Ads                         [+ Post Ad]

[All] [Online] [Offline] [Private]

─────────────────────────────────────────
Sell USDT With ETB     ● Online
178.00 ETB per USDT
Available: 998 / 1,000 USDT
Limit: Br 3,000 – Br 200,000
[CBE] [Telebirr]
             [Edit ✏]  [●/○]  [🗑 Delete]
─────────────────────────────────────────

Empty state:
[ads icon]
No ads yet
[Post your first ad] button
```

---

## PART 4 — COMPLETE STATE MACHINE

The trade screen must handle ALL these states correctly:

```
ORDER STATUS FLOW:

unpaid ──────────────────────────────→ cancelled
  │ (buyer taps Pay → payment screen)     ↑ (timer expires OR buyer cancels)
  ↓
paid ────────────────────────────────→ appeal
  │ (seller taps Release)                  ↑ (appeal timer expires + buyer taps)
  ↓
completed
```

**What each party sees:**

| Status | Buyer sees | Seller sees |
|---|---|---|
| unpaid | "Order Created" + Pay button | "Waiting for buyer" |
| paying | Payment instructions + "I have paid" | "Waiting for buyer" |
| paid | "Waiting for seller to release" + Appeal countdown | "Buyer paid" + Release button |
| completed | Success screen + rate | Success screen + rate |
| cancelled | "Order Cancelled" | "Order Cancelled" |
| appeal | "Under Appeal" + admin pending | "Under Appeal" + admin pending |

---

## PART 5 — SAFETY MESSAGES (exact text, do not change)

**Sticky warning in chat:**
```
⚠️ Please do not use third-party platforms for communication,
as external chat history cannot be used as valid evidence
in order disputes.
```

**Platform Notice modal (once per order when status → 'paid'):**
```
Title: "Platform Notice"
Body:
1. Please do not use third-party platforms for communication,
   as external chat history cannot be used as valid evidence
   in order disputes.
2. The crypto in this order has been locked, and your order
   is securely protected.
Button: "Got It"
```
Save to localStorage: `p2p_notice_${orderId}` = '1'

**Payment confirmation warning:**
```
"Clicking [Confirm] without making payment may put your account at risk."
```

**P2P Trading Tips:**
```
1. Always communicate via the platform. Do not use third-party platforms.
2. If you have already paid, do not cancel the order.
   If the other party asks to cancel, please file an appeal.
```

**Release warning:**
```
"Only release AFTER confirming:
• Payment received in your account
• Sender name matches KYC name
• Full amount — not partial payment"
```

---

## PART 6 — ERROR MESSAGES (show exact text from API)

Frontend pattern — use this everywhere:
```typescript
const res = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('p2p_token')}`
  },
  body: JSON.stringify(payload)
});
const data = await res.json();
if (!res.ok) {
  setError(data.message || 'Something went wrong');
  return;
}
```

Backend error messages:
```
404: "Advertisement not found"
400: "This ad is no longer available"
400: "Cannot trade your own advertisement"
400: "Minimum order amount is Br X,XXX"
400: "Maximum order amount is Br XXX,XXX"
400: "Please select a payment method"
400: "Invalid payment method for this ad"
400: "Insufficient ad balance. Please reduce your amount."
400: "Seller has insufficient balance"
403: "Complete KYC verification to start trading"
403: "Account suspended. Contact support@ethiop2p.com"
500: "Order creation failed. Please try again."
```

---

## PART 7 — WALLET BALANCE SYNC

After order completed, wallet must update in real time:

```typescript
// Buyer wallet after release:
available_balance += amountUsdt  ← USDT arrives

// Seller wallet after release:
frozen_balance -= amountUsdt     ← escrow released

// Use React Query invalidation:
queryClient.invalidateQueries({ queryKey: ['wallet'] });
queryClient.invalidateQueries({ queryKey: ['orders'] });
```

On /wallet page:
- Available balance shown normally
- Frozen balance shown in YELLOW if > 0 (in active orders)
- Transaction history shows p2p_buy / p2p_sell entries

---

## SUMMARY — WHAT TO BUILD

1. Fix `POST /api/orders` — use DB transaction, exact error messages
2. Add `PATCH /api/orders/:id/mark-paid`
3. Add `PATCH /api/orders/:id/release` — transfer USDT escrow to buyer
4. Add `PATCH /api/orders/:id/cancel` — unfreeze USDT to seller
5. Add `POST /api/orders/:id/appeal`
6. Add `GET/POST /api/orders/:id/messages`
7. Fix `GET /api/ads` — proper filters, exclude own ads, include stats
8. Fix `POST /api/ads` — freeze USDT for sell ads
9. Add `PATCH /api/ads/:id` — price/status update
10. Build `/p2p` marketplace with real-time 30s refresh
11. Build order confirmation screen with exact error display
12. Build `/trade/:id` with all 7 status states
13. Build `/chat/:orderId` with auto-reply + system messages
14. Build `/orders` with Open/Ended tabs
15. Build `/ads/post` 3-step wizard
16. Build `/ads` my ads list

