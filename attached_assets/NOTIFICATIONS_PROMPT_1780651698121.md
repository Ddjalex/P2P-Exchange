# EthioP2P — Complete Real-time Notification System
# Paste this into Replit AI

---

## IMPORTANT
Do not touch auth, KYC, deposit, admin dashboard.
Only build the notification system as described below.

---

## PART 1 — DATABASE

Add notifications table if not exists:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_order_id INTEGER,
  related_ad_id INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, is_read);
```

---

## PART 2 — BACKEND NOTIFICATION HELPER

Create `artifacts/api-server/src/helpers/notify.ts`:

```typescript
import { db } from '../db';
import { notifications } from '../schema';

interface NotifyParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedOrderId?: number;
  relatedAdId?: number;
  metadata?: Record<string, any>;
}

export async function notify(params: NotifyParams) {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      isRead: false,
      relatedOrderId: params.relatedOrderId ?? null,
      relatedAdId: params.relatedAdId ?? null,
      metadata: params.metadata ?? {},
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    // Never throw — notification failure should not break main flow
  }
}

export async function notifyBoth(
  userId1: number,
  userId2: number,
  type: string,
  title: string,
  message: string,
  relatedOrderId?: number
) {
  await Promise.all([
    notify({ userId: userId1, type, title, message, relatedOrderId }),
    notify({ userId: userId2, type, title, message, relatedOrderId })
  ]);
}
```

---

## PART 3 — BACKEND NOTIFICATION ROUTES

Add to `artifacts/api-server/src/routes/notifications.ts`:

```typescript
import { notify } from '../helpers/notify';

// GET /api/notifications — get all notifications for current user
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.user.id),
      orderBy: desc(notifications.createdAt),
      limit,
      offset
    });

    const unreadCount = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, req.user.id),
        eq(notifications.isRead, false)
      )
    });

    return res.json({
      notifications: userNotifications,
      unreadCount: unreadCount.length,
      page,
      hasMore: userNotifications.length === limit
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.json({ notifications: [], unreadCount: 0 });
  }
});

// GET /api/notifications/unread-count
app.get('/api/notifications/unread-count', authenticate, async (req, res) => {
  try {
    const unread = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, req.user.id),
        eq(notifications.isRead, false)
      )
    });
    return res.json({ count: unread.length });
  } catch (error) {
    return res.json({ count: 0 });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, parseInt(req.params.id)),
        eq(notifications.userId, req.user.id)
      ));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/read-all — mark all as read
app.patch('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.user.id));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:id — delete one
app.delete('/api/notifications/:id', authenticate, async (req, res) => {
  try {
    await db.delete(notifications)
      .where(and(
        eq(notifications.id, parseInt(req.params.id)),
        eq(notifications.userId, req.user.id)
      ));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete' });
  }
});
```

---

## PART 4 — ADD NOTIFICATIONS TO ALL EVENTS

Import `notify` and `notifyBoth` in every relevant route.
Add notification calls after each event:

### 4A — ORDER EVENTS (in orders.ts)

```typescript
import { notify, notifyBoth } from '../helpers/notify';

// After order created (POST /api/orders):
await notify({
  userId: order.sellerId,
  type: 'order_created',
  title: '🔔 New Order',
  message: `New order received for ${order.amountUsdt.toFixed(4)} USDT (Br ${Number(order.amountEtb).toLocaleString()})`,
  relatedOrderId: order.id
});

// After buyer marks paid (PATCH /api/orders/:id/mark-paid):
await notify({
  userId: order.sellerId,
  type: 'payment_sent',
  title: '💰 Payment Sent',
  message: `Buyer has marked payment as sent for order #${order.orderNo}. Please verify and release crypto.`,
  relatedOrderId: order.id
});

// After seller releases crypto (PATCH /api/orders/:id/release):
await notify({
  userId: order.buyerId,
  type: 'order_completed',
  title: '✅ Order Completed',
  message: `${order.amountUsdt.toFixed(4)} USDT has been deposited to your wallet!`,
  relatedOrderId: order.id
});
// Also notify seller
await notify({
  userId: order.sellerId,
  type: 'order_completed',
  title: '✅ Order Completed',
  message: `Order #${order.orderNo} completed. Br ${Number(order.amountEtb).toLocaleString()} received.`,
  relatedOrderId: order.id
});

// After order cancelled (PATCH /api/orders/:id/cancel):
const cancelledBy = req.user.id === order.buyerId ? 'buyer' : 'seller';
const counterpartyId = req.user.id === order.buyerId ? order.sellerId : order.buyerId;
await notify({
  userId: counterpartyId,
  type: 'order_cancelled',
  title: '❌ Order Cancelled',
  message: `Order #${order.orderNo} has been cancelled by the ${cancelledBy}.`,
  relatedOrderId: order.id
});

// After appeal raised (POST /api/orders/:id/appeal):
const appealCounterparty = req.user.id === order.buyerId ? order.sellerId : order.buyerId;
await notify({
  userId: appealCounterparty,
  type: 'appeal_raised',
  title: '⚠️ Appeal Raised',
  message: `An appeal has been filed on order #${order.orderNo}. Admin will review shortly.`,
  relatedOrderId: order.id
});
// Notify admin (userId = 1 or from env ADMIN_USER_ID)
await notify({
  userId: 1, // admin user id
  type: 'appeal_admin',
  title: '🚨 New Appeal',
  message: `Appeal filed on order #${order.orderNo} by ${req.user.username}`,
  relatedOrderId: order.id
});
```

### 4B — WALLET EVENTS (in wallet.ts)

```typescript
// After deposit confirmed:
await notify({
  userId: userId,
  type: 'deposit_confirmed',
  title: '💚 Deposit Confirmed',
  message: `${amount} USDT has been deposited to your wallet.`,
});

// After withdrawal approved (admin):
await notify({
  userId: withdrawal.userId,
  type: 'withdrawal_approved',
  title: '✅ Withdrawal Approved',
  message: `Your withdrawal of ${amount} USDT has been approved and is processing.`,
});

// After withdrawal rejected (admin):
await notify({
  userId: withdrawal.userId,
  type: 'withdrawal_rejected',
  title: '❌ Withdrawal Rejected',
  message: `Your withdrawal of ${amount} USDT was rejected. Reason: ${reason}. Funds returned to wallet.`,
});

// After USDT frozen (sell ad posted):
await notify({
  userId: req.user.id,
  type: 'usdt_frozen',
  title: '🔒 USDT Locked',
  message: `${totalAmount} USDT has been locked as collateral for your sell ad.`,
});

// After USDT unfrozen (order cancelled or ad deleted):
await notify({
  userId: sellerId,
  type: 'usdt_unfrozen',
  title: '🔓 USDT Returned',
  message: `${amount} USDT has been returned to your available balance.`,
});
```

### 4C — KYC EVENTS (in kyc.ts)

```typescript
// After KYC approved (admin):
await notify({
  userId: submission.userId,
  type: 'kyc_approved',
  title: '✅ Identity Verified!',
  message: 'Your KYC has been approved. You can now trade on EthioP2P!',
});

// After KYC rejected (admin):
await notify({
  userId: submission.userId,
  type: 'kyc_rejected',
  title: '❌ KYC Rejected',
  message: `Your KYC was rejected. Reason: ${reason}. Please resubmit with correct documents.`,
});

// After KYC more info (admin):
await notify({
  userId: submission.userId,
  type: 'kyc_more_info',
  title: '🔄 Action Required',
  message: `Admin message: ${adminMessage}. Please update your KYC submission.`,
});

// After KYC submitted (notify admin):
await notify({
  userId: 1, // admin
  type: 'kyc_submitted',
  title: '📋 New KYC Submission',
  message: `${req.user.username} submitted KYC documents for review.`,
});
```

### 4D — CHAT EVENTS (in messages.ts)

```typescript
// After new message sent:
await notify({
  userId: receiverId,
  type: 'new_message',
  title: '💬 New Message',
  message: `${req.user.username}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
  relatedOrderId: orderId
});

// After image sent:
await notify({
  userId: receiverId,
  type: 'new_message',
  title: '💬 New Message',
  message: `${req.user.username} sent an image`,
  relatedOrderId: orderId
});
```

### 4E — SECURITY EVENTS (in auth.ts)

```typescript
// After password changed:
await notify({
  userId: req.user.id,
  type: 'password_changed',
  title: '🔐 Password Changed',
  message: 'Your password was changed successfully. If this was not you, contact support immediately.',
});

// After account suspended (admin):
await notify({
  userId: userId,
  type: 'account_suspended',
  title: '🚫 Account Suspended',
  message: `Your account has been suspended. Reason: ${reason}. Contact support@ethiop2p.com`,
});

// After account unsuspended (admin):
await notify({
  userId: userId,
  type: 'account_unsuspended',
  title: '✅ Account Restored',
  message: 'Your account suspension has been lifted. You can now trade again.',
});
```

### 4F — ADS EVENTS (in ads.ts)

```typescript
// After ad fully traded (availableAmount = 0):
await notify({
  userId: ad.userId,
  type: 'ad_completed',
  title: '🎯 Ad Fully Traded',
  message: `Your ${ad.type} ad for ${ad.totalAmount} USDT has been fully traded and closed.`,
  relatedAdId: ad.id
});

// After ad suspended by admin:
await notify({
  userId: ad.userId,
  type: 'ad_suspended',
  title: '⚠️ Ad Suspended',
  message: `Your ad has been suspended by admin. Contact support for more information.`,
  relatedAdId: ad.id
});
```

---

## PART 5 — FRONTEND NOTIFICATION BELL

### 5A — Notification Bell Component
Create `src/components/notification-bell.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const NOTIFICATION_ICONS: Record<string, string> = {
  order_created: '🔔',
  payment_sent: '💰',
  order_completed: '✅',
  order_cancelled: '❌',
  appeal_raised: '⚠️',
  appeal_resolved: '⚖️',
  deposit_confirmed: '💚',
  withdrawal_approved: '✅',
  withdrawal_rejected: '❌',
  usdt_frozen: '🔒',
  usdt_unfrozen: '🔓',
  kyc_approved: '✅',
  kyc_rejected: '❌',
  kyc_more_info: '🔄',
  new_message: '💬',
  password_changed: '🔐',
  account_suspended: '🚫',
  account_unsuspended: '✅',
  ad_completed: '🎯',
  ad_suspended: '⚠️',
};

const NOTIFICATION_COLORS: Record<string, string> = {
  order_created: '#00d4ff',
  payment_sent: '#00d4ff',
  order_completed: '#00e676',
  order_cancelled: '#ff4444',
  appeal_raised: '#ff8800',
  deposit_confirmed: '#00e676',
  withdrawal_approved: '#00e676',
  withdrawal_rejected: '#ff4444',
  kyc_approved: '#00e676',
  kyc_rejected: '#ff4444',
  kyc_more_info: '#ff8800',
  new_message: '#00d4ff',
  account_suspended: '#ff4444',
  account_unsuspended: '#00e676',
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const token = localStorage.getItem('p2p_token');

  // Poll unread count every 10 seconds
  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => fetch('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: true
  });

  // Fetch notifications when panel opens
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()),
    enabled: isOpen,
    refetchInterval: isOpen ? 15000 : false
  });

  const markAllRead = useMutation({
    mutationFn: () => fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notif-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markOneRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    queryClient.invalidateQueries({ queryKey: ['notif-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const unreadCount = countData?.count ?? 0;
  const notifs = notifData?.notifications ?? [];

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none',
          cursor: 'pointer', position: 'relative',
          padding: '8px', color: '#fff'
        }}>
        <span style={{ fontSize: '22px' }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: '#ff4444',
            color: '#fff',
            fontSize: '10px', fontWeight: 700,
            borderRadius: '50%',
            minWidth: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 998
            }} />

          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: 0, right: 0,
            width: '100%',
            maxWidth: '400px',
            height: '100vh',
            background: '#0f1929',
            borderLeft: '1px solid #334455',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.5)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 16px',
              borderBottom: '1px solid #1e2d3d'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: '20px', cursor: 'pointer' }}>
                  ←
                </button>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#ff4444', color: '#fff',
                    fontSize: '11px', fontWeight: 700,
                    borderRadius: '10px', padding: '2px 7px'
                  }}>{unreadCount}</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  style={{
                    background: 'none', border: 'none',
                    color: '#00d4ff', fontSize: '12px',
                    cursor: 'pointer', fontWeight: 600
                  }}>
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifs.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '300px', color: '#8899aa'
                }}>
                  <span style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</span>
                  <p style={{ fontSize: '14px' }}>No notifications yet</p>
                </div>
              ) : (
                notifs.map((notif: any) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markOneRead(notif.id);
                      setIsOpen(false);
                      // Navigate to related order if exists
                      if (notif.relatedOrderId) {
                        window.location.href = `/trade/${notif.relatedOrderId}`;
                      }
                    }}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '14px 16px',
                      borderBottom: '1px solid #1a2535',
                      cursor: 'pointer',
                      background: notif.isRead ? 'transparent' : 'rgba(0,212,255,0.04)',
                      transition: 'background 0.2s'
                    }}>
                    {/* Icon circle */}
                    <div style={{
                      width: '40px', height: '40px',
                      borderRadius: '50%',
                      background: `${NOTIFICATION_COLORS[notif.type] || '#00d4ff'}22`,
                      border: `1.5px solid ${NOTIFICATION_COLORS[notif.type] || '#00d4ff'}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', flexShrink: 0
                    }}>
                      {NOTIFICATION_ICONS[notif.type] || '🔔'}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <p style={{
                          color: '#fff', fontSize: '13px',
                          fontWeight: notif.isRead ? 400 : 600,
                          margin: 0, marginBottom: '4px'
                        }}>{notif.title}</p>
                        {!notif.isRead && (
                          <div style={{
                            width: '8px', height: '8px',
                            borderRadius: '50%',
                            background: '#00d4ff',
                            flexShrink: 0, marginLeft: '8px', marginTop: '4px'
                          }} />
                        )}
                      </div>
                      <p style={{
                        color: '#8899aa', fontSize: '12px',
                        margin: 0, marginBottom: '4px',
                        lineHeight: '1.4'
                      }}>{notif.message}</p>
                      <p style={{
                        color: '#556677', fontSize: '11px', margin: 0
                      }}>{timeAgo(notif.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### 5B — Add Bell to Navigation
In every page header/navbar replace the plain bell icon with:
```tsx
import { NotificationBell } from '@/components/notification-bell';

// In header:
<NotificationBell />
```

---

## PART 6 — REAL-TIME TRADE PAGE POLLING

In `src/pages/trade.tsx` add live order status polling:

```typescript
import { useRef, useEffect } from 'react';
import { toast } from 'sonner'; // or whatever toast library is used

// Poll order every 5 seconds
const { data: order, refetch } = useQuery({
  queryKey: ['order', orderId],
  queryFn: () => fetch(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json()),
  refetchInterval: 5000,
  refetchIntervalInBackground: true
});

// Detect status changes and show toast
const prevStatusRef = useRef<string | null>(null);
useEffect(() => {
  if (!order?.status) return;
  const prev = prevStatusRef.current;
  const curr = order.status;

  if (prev && prev !== curr) {
    switch (curr) {
      case 'paid':
        toast.success('💰 Buyer has marked payment as sent!');
        // Play sound for seller
        try { new Audio('/notification.mp3').play(); } catch {}
        break;
      case 'completed':
        toast.success('🎉 Order completed! USDT released.');
        try { new Audio('/notification.mp3').play(); } catch {}
        break;
      case 'cancelled':
        toast.error('❌ Order has been cancelled.');
        break;
      case 'appeal':
        toast.warning('⚠️ Appeal has been raised on this order.');
        break;
    }
  }

  prevStatusRef.current = curr;
}, [order?.status]);
```

---

## PART 7 — REAL-TIME NEW ORDER ALERT (for sellers)

In `src/pages/orders.tsx` or a global layout component:

```typescript
// Poll for new open orders every 10 seconds (for sellers)
const prevOrderCountRef = useRef<number>(0);

const { data: openOrders } = useQuery({
  queryKey: ['open-orders-poll'],
  queryFn: () => fetch('/api/orders?status=unpaid&role=seller', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json()),
  refetchInterval: 10000,
  refetchIntervalInBackground: true
});

useEffect(() => {
  if (!openOrders) return;
  const count = openOrders.length ?? 0;
  if (prevOrderCountRef.current > 0 && count > prevOrderCountRef.current) {
    // New order arrived!
    toast.success('🔔 New order received!', {
      duration: 8000,
      action: {
        label: 'View',
        onClick: () => navigate('/orders')
      }
    });
    try { new Audio('/notification.mp3').play(); } catch {}
    // Refresh notification bell count
    queryClient.invalidateQueries({ queryKey: ['notif-count'] });
  }
  prevOrderCountRef.current = count;
}, [openOrders?.length]);
```

---

## PART 8 — NOTIFICATION SOUND

Add a short notification sound at `public/notification.mp3`.
Use any short beep or chime sound under 100KB.
If you can't add a file, use this Web Audio API fallback instead:

```typescript
// Play beep using Web Audio API (no file needed)
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Sound not supported — silent fail
  }
}

// Use instead of new Audio('/notification.mp3').play()
playNotificationSound();
```

---

## PART 9 — CHAT REAL-TIME POLLING

In `src/pages/chat.tsx` (order chat):

```typescript
// Poll messages every 3 seconds while chat is open
const { data: messages } = useQuery({
  queryKey: ['messages', orderId],
  queryFn: () => fetch(`/api/orders/${orderId}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json()),
  refetchInterval: 3000,
  refetchIntervalInBackground: false // only poll when tab active
});

// Auto-scroll to bottom when new message arrives
const messagesEndRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages?.length]);

// At the bottom of messages list:
<div ref={messagesEndRef} />
```

---

## COMPLETE NOTIFICATION TRIGGER MAP

| Event | Trigger location | Recipients |
|---|---|---|
| New order | POST /api/orders | Seller |
| Buyer paid | PATCH /orders/:id/mark-paid | Seller |
| Crypto released | PATCH /orders/:id/release | Buyer + Seller |
| Order cancelled | PATCH /orders/:id/cancel | Counterparty |
| Appeal raised | POST /orders/:id/appeal | Counterparty + Admin |
| Appeal resolved | Admin resolves | Both parties |
| Deposit confirmed | Wallet deposit flow | User |
| Withdrawal approved | Admin approves | User |
| Withdrawal rejected | Admin rejects | User |
| USDT frozen | POST /api/ads (sell) | Seller |
| USDT unfrozen | Order cancel / ad delete | Seller |
| KYC approved | Admin approves | User |
| KYC rejected | Admin rejects | User |
| KYC more info | Admin requests | User |
| KYC submitted | POST /api/kyc | Admin |
| New message | POST /orders/:id/messages | Receiver |
| Password changed | POST /api/auth/change-password | User |
| Account suspended | Admin suspends | User |
| Account unsuspended | Admin unsuspends | User |
| Ad fully traded | Order completed (availableAmount=0) | Ad owner |
| Ad suspended | Admin suspends ad | Ad owner |

