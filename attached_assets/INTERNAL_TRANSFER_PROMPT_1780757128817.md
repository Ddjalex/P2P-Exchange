# Xendrx — User UID + Internal Transfer System
# Transfer USDT between Xendrx users with zero fee
# Reference: Bybit Internal Transfer + Binance UID system
# Paste this into Replit AI

---

## WHAT THIS BUILDS
1. Every user gets a unique UID (like Binance: 120100976)
2. Internal Transfer option in Withdraw page
3. Transfer by: Email / Phone / UID
4. Zero fee for internal transfers
5. Instant — no blockchain needed
6. Transfer history in wallet transactions

---

## PART 1 — DATABASE CHANGES

```sql
-- Add UID to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS uid VARCHAR(20) UNIQUE;

-- Generate UIDs for existing users
UPDATE users SET uid = LPAD(id::text, 9, '1') || FLOOR(RANDOM() * 1000)::text
WHERE uid IS NULL;

-- Create UID sequence for new users (starts at 100000001)
CREATE SEQUENCE IF NOT EXISTS user_uid_seq START 100000001;

-- Internal transfers table
CREATE TABLE IF NOT EXISTS internal_transfers (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id) NOT NULL,
  receiver_id INTEGER REFERENCES users(id) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  note TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## PART 2 — GENERATE UID ON REGISTER

In `artifacts/api-server/src/routes/auth.ts` update register:

```typescript
// Generate unique UID for new user
function generateUID(): string {
  // Format: 9-digit number starting with 1
  // e.g. 120100976, 143829471
  const base = Math.floor(100000000 + Math.random() * 900000000);
  return base.toString();
}

// In POST /api/auth/register, when creating user:
const uid = generateUID();

// Check UID is unique (retry if collision)
let finalUid = uid;
let attempts = 0;
while (attempts < 10) {
  const existing = await db.query.users.findFirst({
    where: eq(users.uid, finalUid)
  });
  if (!existing) break;
  finalUid = generateUID();
  attempts++;
}

// Insert with UID
const [newUser] = await db.insert(users).values({
  username,
  email: type === 'email' ? identifier : null,
  phone: type === 'phone' ? identifier : null,
  uid: finalUid,
  country,
  passwordHash: hashedPassword,
  kycStatus: 'pending',
  createdAt: new Date()
}).returning();
```

---

## PART 3 — SHOW UID IN PROFILE

In `src/pages/profile.tsx` show UID prominently:

```tsx
// Fetch user with UID
const { data: authData } = useQuery({
  queryKey: ['me'],
  queryFn: () => fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())
});

const user = authData?.user;

// UID display section (below avatar/username):
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '6px'
}}>
  <span style={{ color: '#8899aa', fontSize: '12px' }}>UID:</span>
  <span style={{
    color: '#fff', fontSize: '14px',
    fontWeight: 600, fontFamily: 'monospace',
    letterSpacing: '1px'
  }}>
    {user?.uid || '—'}
  </span>
  <button
    onClick={() => {
      navigator.clipboard.writeText(user?.uid || '');
      toast.success('UID copied!');
    }}
    style={{
      background: 'none', border: 'none',
      color: '#00e5ff', cursor: 'pointer',
      fontSize: '14px', padding: '2px'
    }}>
    📋
  </button>
</div>
```

Also add to `GET /api/auth/me` response:
```typescript
return res.json({
  user: {
    ...user,
    uid: user.uid  // make sure UID is included
  }
});
```

---

## PART 4 — INTERNAL TRANSFER API ROUTES

Add to `artifacts/api-server/src/routes/wallet.ts`:

```typescript
// GET /api/wallet/find-user
// Find user by UID, email, or phone for transfer
app.get('/api/wallet/find-user', authenticate, async (req, res) => {
  try {
    const { identifier, type } = req.query;
    // type: 'uid' | 'email' | 'phone'

    if (!identifier || !type) {
      return res.status(400).json({ message: 'Identifier and type required' });
    }

    let user;
    if (type === 'uid') {
      user = await db.query.users.findFirst({
        where: eq(users.uid, identifier as string)
      });
    } else if (type === 'email') {
      user = await db.query.users.findFirst({
        where: eq(users.email, identifier as string)
      });
    } else if (type === 'phone') {
      user = await db.query.users.findFirst({
        where: eq(users.phone, identifier as string)
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found on Xendrx' });
    }

    // Cannot transfer to yourself
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Return safe user info only
    return res.json({
      found: true,
      user: {
        uid: user.uid,
        username: user.username,
        // Show masked name for privacy
        displayName: maskName(user.username)
      }
    });

  } catch (error) {
    console.error('Find user error:', error);
    return res.status(500).json({ message: 'Search failed' });
  }
});

// Helper: mask username for privacy (show first 2 + last 2 chars)
function maskName(name: string): string {
  if (name.length <= 4) return name[0] + '***';
  return name.slice(0, 2) + '***' + name.slice(-2);
}

// POST /api/wallet/internal-transfer
app.post('/api/wallet/internal-transfer', authenticate, async (req, res) => {
  try {
    const { identifier, identifierType, amount, note } = req.body;

    // Validate inputs
    if (!identifier || !identifierType || !amount) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (transferAmount < 1) {
      return res.status(400).json({ message: 'Minimum transfer is 1 USDT' });
    }

    // KYC check
    if (req.user.kycStatus !== 'verified') {
      return res.status(403).json({ message: 'Complete KYC to transfer' });
    }

    // Find receiver
    let receiver;
    if (identifierType === 'uid') {
      receiver = await db.query.users.findFirst({ where: eq(users.uid, identifier) });
    } else if (identifierType === 'email') {
      receiver = await db.query.users.findFirst({ where: eq(users.email, identifier) });
    } else if (identifierType === 'phone') {
      receiver = await db.query.users.findFirst({ where: eq(users.phone, identifier) });
    }

    if (!receiver) {
      return res.status(404).json({ message: 'Recipient not found on Xendrx' });
    }

    if (receiver.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Check sender balance
    const senderWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, req.user.id)
    });

    if (!senderWallet || Number(senderWallet.availableBalance) < transferAmount) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ${Number(senderWallet?.availableBalance || 0).toFixed(4)} USDT`
      });
    }

    // Execute transfer in DB transaction
    await db.transaction(async (tx) => {
      // Deduct from sender
      await tx.update(wallets)
        .set({
          availableBalance: sql`available_balance - ${transferAmount}`
        })
        .where(eq(wallets.userId, req.user.id));

      // Credit receiver
      await tx.update(wallets)
        .set({
          availableBalance: sql`available_balance + ${transferAmount}`
        })
        .where(eq(wallets.userId, receiver.id));

      // Create receiver wallet if not exists
      const receiverWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, receiver.id)
      });
      if (!receiverWallet) {
        await tx.insert(wallets).values({
          userId: receiver.id,
          asset: 'USDT',
          availableBalance: transferAmount,
          frozenBalance: 0
        });
      }

      // Log internal transfer
      await tx.insert(internalTransfers).values({
        senderId: req.user.id,
        receiverId: receiver.id,
        amount: transferAmount,
        note: note || null,
        status: 'completed',
        createdAt: new Date()
      });

      // Transaction records for both parties
      await tx.insert(transactions).values([
        {
          userId: req.user.id,
          type: 'internal_send',
          amount: transferAmount,
          status: 'completed',
          note: `Internal transfer to ${receiver.username} (UID: ${receiver.uid})`,
          createdAt: new Date()
        },
        {
          userId: receiver.id,
          type: 'internal_receive',
          amount: transferAmount,
          status: 'completed',
          note: `Internal transfer from ${req.user.username} (UID: ${req.user.uid})`,
          createdAt: new Date()
        }
      ]);

      // In-app notifications
      await tx.insert(notifications).values([
        {
          userId: receiver.id,
          type: 'internal_receive',
          title: '💸 USDT Received',
          message: `${transferAmount} USDT received from ${req.user.username}`,
          createdAt: new Date()
        }
      ]);
    });

    // Telegram notification to receiver
    // TelegramNotify.internalReceive(receiver.id, transferAmount, req.user.username)

    return res.json({
      success: true,
      message: `${transferAmount} USDT sent to ${maskName(receiver.username)} successfully!`
    });

  } catch (error) {
    console.error('Internal transfer error:', error);
    return res.status(500).json({ message: 'Transfer failed. Please try again.' });
  }
});

// GET /api/wallet/transfer-history
app.get('/api/wallet/transfer-history', authenticate, async (req, res) => {
  try {
    const transfers = await db.query.internalTransfers.findMany({
      where: or(
        eq(internalTransfers.senderId, req.user.id),
        eq(internalTransfers.receiverId, req.user.id)
      ),
      orderBy: desc(internalTransfers.createdAt),
      limit: 20
    });

    // Enrich with usernames
    const enriched = await Promise.all(transfers.map(async (t) => {
      const sender = await db.query.users.findFirst({
        where: eq(users.id, t.senderId)
      });
      const receiver = await db.query.users.findFirst({
        where: eq(users.id, t.receiverId)
      });
      return {
        ...t,
        isSender: t.senderId === req.user.id,
        senderUsername: sender?.username,
        senderUid: sender?.uid,
        receiverUsername: receiver?.username,
        receiverUid: receiver?.uid
      };
    }));

    return res.json({ transfers: enriched });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch history' });
  }
});
```

---

## PART 5 — FRONTEND: WITHDRAW PAGE UPDATE

In `src/pages/withdraw.tsx` (or wherever withdraw is):

Add **Internal Transfer** as a withdraw option:

```tsx
const [withdrawMode, setWithdrawMode] = useState<'external' | 'internal'>('external');

// Mode selector at top of withdraw page:
<div style={{
  display: 'flex', gap: '0',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '10px', padding: '3px',
  marginBottom: '20px'
}}>
  <button
    onClick={() => setWithdrawMode('external')}
    style={{
      flex: 1, padding: '10px',
      background: withdrawMode === 'external'
        ? 'rgba(0,229,255,0.15)' : 'transparent',
      border: withdrawMode === 'external'
        ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
      borderRadius: '8px', color: withdrawMode === 'external' ? '#00e5ff' : '#8899aa',
      fontSize: '13px', fontWeight: 600, cursor: 'pointer'
    }}>
    🔗 External Wallet
  </button>
  <button
    onClick={() => setWithdrawMode('internal')}
    style={{
      flex: 1, padding: '10px',
      background: withdrawMode === 'internal'
        ? 'rgba(0,229,255,0.15)' : 'transparent',
      border: withdrawMode === 'internal'
        ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
      borderRadius: '8px', color: withdrawMode === 'internal' ? '#00e5ff' : '#8899aa',
      fontSize: '13px', fontWeight: 600, cursor: 'pointer'
    }}>
    ⚡ Internal Transfer
  </button>
</div>

{/* Show internal transfer panel */}
{withdrawMode === 'internal' && <InternalTransferPanel />}

{/* Show external withdraw panel */}
{withdrawMode === 'external' && <ExternalWithdrawPanel />}
```

---

## PART 6 — INTERNAL TRANSFER PANEL COMPONENT

Create `src/components/internal-transfer.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function InternalTransferPanel() {
  const [tabType, setTabType] = useState<'uid' | 'email' | 'phone'>('uid');
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = localStorage.getItem('p2p_token');
  const queryClient = useQueryClient();

  // Wallet balance
  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => fetch('/api/wallet', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json())
  });
  const available = Number(walletData?.wallet?.availableBalance || 0);

  // Search user
  const searchUser = async () => {
    if (!identifier.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchError('');

    try {
      const res = await fetch(
        `/api/wallet/find-user?identifier=${encodeURIComponent(identifier)}&type=${tabType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok && data.found) {
        setFoundUser(data.user);
      } else {
        setSearchError(data.message || 'User not found');
      }
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  };

  // Send transfer
  const handleTransfer = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wallet/internal-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          identifier,
          identifierType: tabType,
          amount: parseFloat(amount),
          note: note.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      setFoundUser(null);
      setIdentifier('');
      setAmount('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }
  });

  // Success screen
  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Transfer Successful!
        </div>
        <div style={{ color: '#8899aa', fontSize: '13px', marginBottom: '24px' }}>
          USDT has been sent instantly with zero fees
        </div>
        <button
          onClick={() => setSuccess(false)}
          style={{
            background: '#00e5ff', border: 'none', borderRadius: '24px',
            padding: '12px 32px', color: '#080d18', fontWeight: 700,
            fontSize: '14px', cursor: 'pointer'
          }}>
          Send Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Zero fee badge */}
      <div style={{
        background: 'rgba(0,229,255,0.08)',
        border: '1px solid rgba(0,229,255,0.25)',
        borderRadius: '10px', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '20px'
      }}>
        <span style={{ fontSize: '18px' }}>⚡</span>
        <div>
          <div style={{ color: '#00e5ff', fontSize: '13px', fontWeight: 600 }}>
            Internal Transfer — Zero Fees
          </div>
          <div style={{ color: '#8899aa', fontSize: '11px' }}>
            Transfer instantly to any Xendrx user
          </div>
        </div>
        <span style={{
          marginLeft: 'auto', background: '#00e5ff',
          color: '#080d18', fontSize: '10px', fontWeight: 700,
          padding: '3px 8px', borderRadius: '10px'
        }}>0 Fee</span>
      </div>

      {/* Recipient tabs: UID / Email / Phone */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#8899aa', fontSize: '11px',
          marginBottom: '8px', letterSpacing: '1px' }}>
          RECIPIENT
        </div>
        <div style={{
          display: 'flex', gap: '0',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px', padding: '2px'
        }}>
          {(['uid', 'email', 'phone'] as const).map(t => (
            <button key={t}
              onClick={() => { setTabType(t); setFoundUser(null); setIdentifier(''); setSearchError(''); }}
              style={{
                flex: 1, padding: '8px',
                background: tabType === t ? 'rgba(0,229,255,0.15)' : 'transparent',
                border: tabType === t ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
                borderRadius: '6px',
                color: tabType === t ? '#00e5ff' : '#8899aa',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                textTransform: 'uppercase'
              }}>
              {t === 'uid' ? 'UID' : t === 'email' ? 'Email' : 'Phone'}
            </button>
          ))}
        </div>
      </div>

      {/* Identifier input */}
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <input
          value={identifier}
          onChange={e => { setIdentifier(e.target.value); setFoundUser(null); setSearchError(''); }}
          onBlur={searchUser}
          placeholder={
            tabType === 'uid' ? 'Enter UID (e.g. 120100976)' :
            tabType === 'email' ? 'Enter email address' :
            'Enter phone number'
          }
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${foundUser ? '#00e5ff' : searchError ? '#ff4444' : '#334455'}`,
            borderRadius: '10px', padding: '12px 50px 12px 14px',
            color: '#fff', fontSize: '14px', outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {/* Paste button */}
        <button
          onClick={async () => {
            const text = await navigator.clipboard.readText();
            setIdentifier(text);
            setTimeout(searchUser, 100);
          }}
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none',
            color: '#00e5ff', cursor: 'pointer', fontSize: '18px'
          }}>📋</button>
      </div>

      {/* Search result */}
      {searching && (
        <div style={{ color: '#8899aa', fontSize: '12px', marginBottom: '12px' }}>
          Searching...
        </div>
      )}
      {searchError && (
        <div style={{ color: '#ff4444', fontSize: '12px', marginBottom: '12px' }}>
          ❌ {searchError}
        </div>
      )}
      {foundUser && (
        <div style={{
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.25)',
          borderRadius: '10px', padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,229,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#00e5ff', fontWeight: 700, fontSize: '14px'
          }}>
            {foundUser.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
              {foundUser.displayName}
            </div>
            <div style={{ color: '#8899aa', fontSize: '11px' }}>
              UID: {foundUser.uid}
            </div>
          </div>
          <span style={{
            marginLeft: 'auto', color: '#00e5ff',
            fontSize: '16px'
          }}>✓</span>
        </div>
      )}

      {/* Amount */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#8899aa', fontSize: '11px',
          marginBottom: '8px', letterSpacing: '1px' }}>
          AMOUNT (USDT)
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Min. 1 USDT"
            min="1"
            step="0.0001"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid #334455', borderRadius: '10px',
              padding: '12px 60px 12px 14px',
              color: '#fff', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => setAmount(available.toFixed(4))}
            style={{
              position: 'absolute', right: '10px', top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)',
              borderRadius: '6px', padding: '4px 8px',
              color: '#00e5ff', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
            }}>MAX</button>
        </div>
        <div style={{ color: '#8899aa', fontSize: '11px', marginTop: '6px' }}>
          Available: {available.toFixed(4)} USDT
        </div>
      </div>

      {/* Note (optional) */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#8899aa', fontSize: '11px',
          marginBottom: '8px', letterSpacing: '1px' }}>
          NOTE (OPTIONAL)
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note..."
          maxLength={100}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1.5px solid #334455', borderRadius: '10px',
            padding: '12px 14px', color: '#fff', fontSize: '13px',
            outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Fee summary */}
      <div style={{
        background: '#0c1420', borderRadius: '10px',
        padding: '12px 14px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#8899aa', fontSize: '12px' }}>Amount</span>
          <span style={{ color: '#fff', fontSize: '12px' }}>
            {amount || '0'} USDT
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#8899aa', fontSize: '12px' }}>Transfer Fee</span>
          <span style={{
            color: '#00e5ff', fontSize: '12px', fontWeight: 700
          }}>Zero Fees</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderTop: '1px solid #1e2d3d', paddingTop: '8px'
        }}>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
            Recipient Gets
          </span>
          <span style={{ color: '#00e5ff', fontSize: '13px', fontWeight: 700 }}>
            {amount || '0'} USDT
          </span>
        </div>
      </div>

      {/* Transfer button */}
      <button
        onClick={() => handleTransfer.mutate()}
        disabled={
          !foundUser ||
          !amount ||
          parseFloat(amount) < 1 ||
          parseFloat(amount) > available ||
          handleTransfer.isPending
        }
        style={{
          width: '100%', height: '50px',
          background: foundUser && amount && parseFloat(amount) >= 1 && parseFloat(amount) <= available
            ? '#00e5ff' : '#334455',
          border: 'none', borderRadius: '25px',
          color: foundUser && amount ? '#080d18' : '#556677',
          fontSize: '15px', fontWeight: 700,
          cursor: foundUser && amount ? 'pointer' : 'not-allowed'
        }}>
        {handleTransfer.isPending ? 'Sending...' : '⚡ Send USDT'}
      </button>

      {handleTransfer.isError && (
        <div style={{
          color: '#ff4444', fontSize: '12px',
          textAlign: 'center', marginTop: '10px'
        }}>
          ❌ {(handleTransfer.error as Error).message}
        </div>
      )}

      {/* Transfer history link */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <a href="/wallet/transfer-history"
          style={{ color: '#00e5ff', fontSize: '12px', textDecoration: 'none' }}>
          View Transfer History →
        </a>
      </div>
    </div>
  );
}
```

---

## PART 7 — TRANSFER HISTORY PAGE

Create `src/pages/transfer-history.tsx`:

```tsx
export default function TransferHistoryPage() {
  const token = localStorage.getItem('p2p_token');

  const { data } = useQuery({
    queryKey: ['transfer-history'],
    queryFn: () => fetch('/api/wallet/transfer-history', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json())
  });

  const transfers = data?.transfers || [];

  return (
    <div style={{ background: '#080d18', minHeight: '100vh',
      padding: '20px', fontFamily: 'Poppins' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={() => history.back()}
          style={{ background: 'none', border: 'none', color: '#fff',
            fontSize: '20px', cursor: 'pointer' }}>←</button>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
          Transfer History
        </h2>
      </div>

      {transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📤</div>
          <div style={{ color: '#8899aa', fontSize: '14px' }}>No transfers yet</div>
        </div>
      ) : (
        transfers.map((t: any) => (
          <div key={t.id} style={{
            background: '#0c1420', borderRadius: '12px',
            padding: '14px 16px', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: t.isSender
                ? 'rgba(255,68,68,0.15)' : 'rgba(0,229,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0
            }}>
              {t.isSender ? '📤' : '📥'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                {t.isSender
                  ? `Sent to ${t.receiverUsername}`
                  : `Received from ${t.senderUsername}`
                }
              </div>
              <div style={{ color: '#8899aa', fontSize: '11px', marginTop: '2px' }}>
                {t.isSender ? `UID: ${t.receiverUid}` : `UID: ${t.senderUid}`}
                {t.note && ` • ${t.note}`}
              </div>
              <div style={{ color: '#556677', fontSize: '10px', marginTop: '2px' }}>
                {new Date(t.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{
              color: t.isSender ? '#ff6b6b' : '#00e5ff',
              fontSize: '14px', fontWeight: 700, flexShrink: 0
            }}>
              {t.isSender ? '-' : '+'}{Number(t.amount).toFixed(4)} USDT
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

Add route in `App.tsx`:
```tsx
import TransferHistoryPage from '@/pages/transfer-history';
<Route path="/wallet/transfer-history" component={TransferHistoryPage} />
```

---

## PART 8 — ADD TELEGRAM NOTIFICATION FOR TRANSFER

In `artifacts/api-server/src/telegram/notify.ts` add:

```typescript
async internalReceive(userId: number, amount: string, senderName: string) {
  const tgId = await getTgId(userId);
  if (!tgId) return;
  await sendTelegramMessage(
    tgId,
    `💸 *USDT Received!*\n\n` +
    `\`${amount} USDT\` received from *${senderName}*\n` +
    `Fee: Zero ⚡\n\n` +
    `Check your Xendrx wallet!`,
    `${APP_URL}/wallet`
  );
}
```

Call after successful transfer:
```typescript
TelegramNotify.internalReceive(
  receiver.id,
  transferAmount.toFixed(4),
  req.user.username
).catch(console.error);
```

---

## PART 9 — SHOW UID ON WALLET PAGE

In wallet page header, show current user UID prominently:

```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '6px',
  marginBottom: '8px'
}}>
  <span style={{ color: '#556677', fontSize: '11px' }}>Your UID:</span>
  <span style={{
    color: '#00e5ff', fontSize: '13px',
    fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px'
  }}>
    {user?.uid}
  </span>
  <button
    onClick={() => {
      navigator.clipboard.writeText(user?.uid || '');
      toast.success('UID copied!');
    }}
    style={{
      background: 'none', border: 'none',
      color: '#00e5ff', cursor: 'pointer', fontSize: '12px'
    }}>📋</button>
</div>
```

---

## COMPLETE FEATURE SUMMARY

```
USER UID:
- Every user gets unique 9-digit UID on register
- Shown on profile page with copy button
- Shown on wallet page header
- Used for internal transfers

INTERNAL TRANSFER:
- In Withdraw page → "Internal Transfer" tab
- Search by: UID / Email / Phone
- Shows masked recipient name after search
- Enter amount (min 1 USDT)
- Optional note
- Zero fee — recipient gets exact amount
- Instant — no blockchain wait
- Transfer history page

NOTIFICATIONS:
- In-app notification to receiver
- Telegram message to receiver (if linked)
- Transaction shows in wallet history
```

