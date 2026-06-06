# Xendrx — PWA Notification Bar + Icon Badge Update
# Shows notifications in phone notification bar like Instagram/WhatsApp
# Shows red badge count on app icon
# Paste this into Replit AI — UPDATE existing PWA setup

---

## WHAT THIS ADDS
- Notification shows in phone notification bar (like image 4)
- App icon shows red badge count (like Instagram)
- Notification has Xendrx icon + title + message
- Tapping notification opens the right page
- Works when app is closed or in background
- Works on Android Chrome + Samsung Browser
- iOS: shows when app is open (iOS blocks background push)

---

## UPDATE 1 — Enhanced Service Worker
Replace existing `public/sw.js` push handler:

```javascript
// ── PUSH NOTIFICATION HANDLER ──
self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); }
  catch { data = { title: 'Xendrx', body: event.data.text() }; }

  // Notification options — shows in phone notification bar
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',    // Xendrx icon in notification
    badge: '/icons/icon-72x72.png',     // Small icon in status bar
    image: data.image || null,          // Optional image preview
    vibrate: [100, 50, 100],
    sound: '/notification.mp3',
    timestamp: Date.now(),
    tag: data.tag || 'xendrx',          // Groups same-type notifications
    renotify: true,                     // Always show even if same tag
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
      orderId: data.orderId || null,
      type: data.type || 'general'
    },
    // Action buttons on notification
    actions: []
  };

  // Custom settings per notification type
  switch (data.type) {

    case 'order_created':
      options.vibrate = [200, 100, 200, 100, 200];
      options.requireInteraction = true;
      options.tag = `order-${data.orderId}`;
      options.actions = [
        { action: 'view_order', title: '👁 View Order', icon: '/icons/icon-72x72.png' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
      break;

    case 'payment_sent':
      options.vibrate = [300, 100, 300, 100, 300];
      options.requireInteraction = true;
      options.tag = `paid-${data.orderId}`;
      options.actions = [
        { action: 'release', title: '✅ Release Crypto', icon: '/icons/icon-72x72.png' },
        { action: 'view_order', title: '👁 View Order' }
      ];
      break;

    case 'order_completed':
      options.vibrate = [100, 50, 100, 50, 200, 50, 200];
      options.tag = `completed-${data.orderId}`;
      options.actions = [
        { action: 'view_wallet', title: '💰 View Wallet' }
      ];
      break;

    case 'order_cancelled':
      options.vibrate = [200];
      options.tag = `cancelled-${data.orderId}`;
      break;

    case 'new_message':
      options.vibrate = [80, 40, 80];
      options.tag = `msg-${data.orderId}`;
      options.renotify = true;
      options.actions = [
        { action: 'reply', title: '💬 Reply' },
        { action: 'view_order', title: '👁 View' }
      ];
      break;

    case 'appeal_raised':
      options.vibrate = [200, 100, 200];
      options.requireInteraction = true;
      options.tag = `appeal-${data.orderId}`;
      break;

    case 'kyc_approved':
      options.vibrate = [100, 50, 200];
      options.tag = 'kyc-approved';
      options.actions = [
        { action: 'start_trading', title: '🚀 Start Trading' }
      ];
      break;

    case 'kyc_rejected':
      options.vibrate = [300];
      options.tag = 'kyc-rejected';
      options.requireInteraction = true;
      options.actions = [
        { action: 'resubmit', title: '📋 Resubmit KYC' }
      ];
      break;

    case 'withdrawal_approved':
      options.vibrate = [100, 50, 100];
      options.tag = 'withdrawal';
      break;

    case 'withdrawal_rejected':
      options.vibrate = [200, 100, 200];
      options.tag = 'withdrawal-rejected';
      options.requireInteraction = true;
      break;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK HANDLER ──
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const { url, orderId, type } = event.notification.data || {};
  let targetUrl = url || '/';

  // Handle action buttons
  switch (event.action) {
    case 'view_order':
      targetUrl = orderId ? `/trade/${orderId}` : '/orders';
      break;
    case 'release':
      targetUrl = orderId ? `/trade/${orderId}` : '/orders';
      break;
    case 'reply':
      targetUrl = orderId ? `/chat/${orderId}` : '/chat';
      break;
    case 'view_wallet':
      targetUrl = '/wallet';
      break;
    case 'start_trading':
      targetUrl = '/p2p';
      break;
    case 'resubmit':
      targetUrl = '/kyc';
      break;
    case 'dismiss':
      return; // just close
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app is open — focus and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // App is closed — open it
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── NOTIFICATION CLOSE HANDLER ──
self.addEventListener('notificationclose', event => {
  // Track dismissed notifications (optional analytics)
  console.log('Notification dismissed:', event.notification.tag);
});
```

---

## UPDATE 2 — App Icon Badge Count

In `src/hooks/use-badges.ts` update to set badge on app icon:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { triggerNotification } from '@/helpers/notifications';

const token = () => localStorage.getItem('p2p_token');

export function useBadges() {
  const prevChatCount = useRef(0);
  const prevOrderCount = useRef(0);
  const prevNotifCount = useRef(0);

  const { data: chatData } = useQuery({
    queryKey: ['badge-chat'],
    queryFn: () => fetch('/api/messages/unread-count', {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(r => r.json()),
    refetchInterval: 5000,
    refetchIntervalInBackground: true
  });

  const { data: orderData } = useQuery({
    queryKey: ['badge-orders'],
    queryFn: () => fetch('/api/orders/active-count', {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(r => r.json()),
    refetchInterval: 5000,
    refetchIntervalInBackground: true
  });

  const { data: notifData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => fetch('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(r => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: true
  });

  const chatCount = chatData?.count ?? 0;
  const orderCount = orderData?.count ?? 0;
  const notifCount = notifData?.count ?? 0;
  const totalBadge = chatCount + orderCount + notifCount;

  // ── SET APP ICON BADGE (shows number on app icon like Instagram) ──
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (totalBadge > 0) {
        (navigator as any).setAppBadge(totalBadge);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  }, [totalBadge]);

  // ── DETECT NEW MESSAGES → SOUND + VIBRATE ──
  useEffect(() => {
    if (chatCount > prevChatCount.current && prevChatCount.current >= 0) {
      triggerNotification('message');
    }
    prevChatCount.current = chatCount;
  }, [chatCount]);

  // ── DETECT NEW ORDERS → SOUND + VIBRATE ──
  useEffect(() => {
    if (orderCount > prevOrderCount.current && prevOrderCount.current >= 0) {
      triggerNotification('order');
    }
    prevOrderCount.current = orderCount;
  }, [orderCount]);

  return { chatCount, orderCount, notifCount, totalBadge };
}
```

---

## UPDATE 3 — Request Permission on First Visit

In `src/pwa.ts` update `subscribeToPush`:

```typescript
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  // Ask permission
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(userId: number) {
  try {
    // Request permission first
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.log('Notification permission denied');
      return null;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    const reg = await navigator.serviceWorker.ready;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.log('No VAPID key — push disabled');
      return null;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });

    // Save to backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('p2p_token')}`
      },
      body: JSON.stringify({ subscription, userId })
    });

    console.log('Push subscription active');
    return subscription;

  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}
```

---

## UPDATE 4 — Show Permission Request Banner

Create `src/components/notification-permission.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { requestNotificationPermission, subscribeToPush } from '@/pwa';

export function NotificationPermissionBanner({ userId }: { userId: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show after 10 seconds if permission not yet decided
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => setShow(true), 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setShow(false);
    await subscribeToPush(userId);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '12px', left: '12px', right: '12px',
      background: '#0c1420',
      border: '1.5px solid #00e5ff',
      borderRadius: '14px',
      padding: '14px 16px',
      zIndex: 9997,
      boxShadow: '0 4px 24px rgba(0,229,255,0.15)',
      fontFamily: 'Poppins, sans-serif',
      display: 'flex', gap: '12px', alignItems: 'center'
    }}>
      <!-- Bell icon -->
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%',
        background: 'rgba(0,229,255,0.1)',
        border: '1.5px solid rgba(0,229,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', flexShrink: 0
      }}>🔔</div>

      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
          Enable notifications
        </div>
        <div style={{ color: '#8899aa', fontSize: '11px', marginTop: '2px' }}>
          Get alerts for orders, payments & messages
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={() => setShow(false)} style={{
          background: 'none', border: '1px solid #334455',
          borderRadius: '16px', padding: '6px 10px',
          color: '#8899aa', fontSize: '11px', cursor: 'pointer'
        }}>Later</button>
        <button onClick={handleEnable} style={{
          background: '#00e5ff', border: 'none',
          borderRadius: '16px', padding: '6px 12px',
          color: '#080d18', fontSize: '11px',
          fontWeight: 700, cursor: 'pointer'
        }}>Enable</button>
      </div>
    </div>
  );
}
```

Add to `App.tsx`:
```tsx
import { NotificationPermissionBanner } from '@/components/notification-permission';

// Inside App, after user is loaded:
{user && <NotificationPermissionBanner userId={user.id} />}
```

---

## UPDATE 5 — Backend: Send Push Notification Helper

Update `artifacts/api-server/src/routes/push.ts`:

```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'support@xendrx.com'}`,
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// All notification payloads — shown in phone notification bar
export const PushNotify = {

  async newOrder(sellerId: number, orderId: number, usdtAmount: string, etbAmount: string) {
    await sendPush(sellerId, {
      title: '🔔 New Order Received!',
      body: `${usdtAmount} USDT — Br ${etbAmount}. Respond quickly!`,
      type: 'order_created',
      url: `/trade/${orderId}`,
      orderId,
      tag: `order-${orderId}`
    });
  },

  async paymentSent(sellerId: number, orderId: number, etbAmount: string) {
    await sendPush(sellerId, {
      title: '💰 Payment Marked as Sent!',
      body: `Buyer sent Br ${etbAmount}. Verify and release crypto.`,
      type: 'payment_sent',
      url: `/trade/${orderId}`,
      orderId,
      tag: `paid-${orderId}`
    });
  },

  async orderCompleted(buyerId: number, orderId: number, usdtAmount: string) {
    await sendPush(buyerId, {
      title: '✅ Order Completed!',
      body: `${usdtAmount} USDT deposited to your wallet!`,
      type: 'order_completed',
      url: '/wallet',
      orderId,
      tag: `completed-${orderId}`
    });
  },

  async orderCancelled(userId: number, orderId: number) {
    await sendPush(userId, {
      title: '❌ Order Cancelled',
      body: 'Your order has been cancelled.',
      type: 'order_cancelled',
      url: '/orders',
      orderId,
      tag: `cancelled-${orderId}`
    });
  },

  async newMessage(receiverId: number, orderId: number, senderName: string, preview: string) {
    await sendPush(receiverId, {
      title: `💬 ${senderName}`,
      body: preview.slice(0, 80),
      type: 'new_message',
      url: `/chat/${orderId}`,
      orderId,
      tag: `msg-${orderId}`
    });
  },

  async appealRaised(userId: number, orderId: number) {
    await sendPush(userId, {
      title: '⚠️ Appeal Raised',
      body: 'An appeal has been filed. Admin will review shortly.',
      type: 'appeal_raised',
      url: `/trade/${orderId}`,
      orderId,
      tag: `appeal-${orderId}`
    });
  },

  async kycApproved(userId: number) {
    await sendPush(userId, {
      title: '✅ Identity Verified!',
      body: 'Your KYC is approved. You can now trade on Xendrx!',
      type: 'kyc_approved',
      url: '/p2p',
      tag: 'kyc-approved'
    });
  },

  async kycRejected(userId: number, reason: string) {
    await sendPush(userId, {
      title: '❌ KYC Rejected',
      body: `Reason: ${reason}. Please resubmit.`,
      type: 'kyc_rejected',
      url: '/kyc',
      tag: 'kyc-rejected'
    });
  },

  async withdrawalApproved(userId: number, amount: string) {
    await sendPush(userId, {
      title: '✅ Withdrawal Approved',
      body: `${amount} USDT is being processed.`,
      type: 'withdrawal_approved',
      url: '/wallet',
      tag: 'withdrawal'
    });
  },

  async withdrawalRejected(userId: number, amount: string, reason: string) {
    await sendPush(userId, {
      title: '❌ Withdrawal Rejected',
      body: `${amount} USDT returned. Reason: ${reason}`,
      type: 'withdrawal_rejected',
      url: '/wallet',
      tag: 'withdrawal-rejected'
    });
  }
};

// Core send function
async function sendPush(userId: number, payload: {
  title: string;
  body: string;
  type: string;
  url?: string;
  orderId?: number;
  tag?: string;
  image?: string;
}) {
  try {
    const subs = await db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, userId)
    });

    if (!subs.length) return;

    await Promise.all(subs.map(async sub => {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify(payload),
          {
            urgency: payload.type === 'new_message' ? 'normal' : 'high',
            TTL: 60 * 60 * 24 // 24 hours
          }
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }));
  } catch (error) {
    console.error('Push send failed:', error);
  }
}
```

---

## UPDATE 6 — Add Push to ALL Events

In every existing order/KYC route, ADD these calls.
DO NOT remove existing in-app notification code.
Just ADD push notification alongside:

```typescript
import { PushNotify } from '../routes/push';

// POST /api/orders — after order created:
await PushNotify.newOrder(
  order.sellerId, order.id,
  order.amountUsdt.toFixed(4),
  Number(order.amountEtb).toLocaleString()
);

// PATCH /api/orders/:id/mark-paid:
await PushNotify.paymentSent(
  order.sellerId, order.id,
  Number(order.amountEtb).toLocaleString()
);

// PATCH /api/orders/:id/release:
await PushNotify.orderCompleted(
  order.buyerId, order.id,
  order.amountUsdt.toFixed(4)
);

// PATCH /api/orders/:id/cancel:
await PushNotify.orderCancelled(counterpartyId, order.id);

// POST /api/orders/:id/appeal:
await PushNotify.appealRaised(counterpartyId, order.id);

// POST /api/orders/:id/messages:
await PushNotify.newMessage(
  receiverId, orderId,
  req.user.username,
  content
);

// Admin: KYC approved:
await PushNotify.kycApproved(submission.userId);

// Admin: KYC rejected:
await PushNotify.kycRejected(submission.userId, reason);

// Admin: withdrawal approved:
await PushNotify.withdrawalApproved(withdrawal.userId, amount);

// Admin: withdrawal rejected:
await PushNotify.withdrawalRejected(withdrawal.userId, amount, reason);
```

---

## WHAT NOTIFICATION LOOKS LIKE IN PHONE BAR

```
┌─────────────────────────────────────┐
│ [Xendrx Icon]  Xendrx          now  │
│ 🔔 New Order Received!              │
│ 100 USDT — Br 17,800. Respond!     │
│ ─────────────────────────────────── │
│  [👁 View Order]    [✕ Dismiss]     │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ [Xendrx Icon]  Xendrx          now  │
│ 💰 Payment Marked as Sent!          │
│ Buyer sent Br 17,800. Verify now.  │
│ ─────────────────────────────────── │
│  [✅ Release Crypto] [👁 View]      │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ [Xendrx Icon]  Xendrx          now  │
│ 💬 Trust & Fast                     │
│ "Please check my payment receipt"  │
│ ─────────────────────────────────── │
│  [💬 Reply]         [👁 View]       │
└─────────────────────────────────────┘
```

