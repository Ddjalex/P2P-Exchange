// ── Xendrx Service Worker ──

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', () => {});

// ── PUSH NOTIFICATION HANDLER ──
self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); }
  catch { data = { title: 'Xendrx', body: event.data.text() }; }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: data.image || null,
    vibrate: [100, 50, 100],
    timestamp: Date.now(),
    tag: data.tag || 'xendrx',
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
      orderId: data.orderId || null,
      type: data.type || 'general'
    },
    actions: []
  };

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
    self.registration.showNotification(data.title || 'Xendrx', options)
  );
});

// ── NOTIFICATION CLICK HANDLER ──
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const { url, orderId } = event.notification.data || {};
  let targetUrl = url || '/';

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
      return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── NOTIFICATION CLOSE HANDLER ──
self.addEventListener('notificationclose', event => {
  console.log('Notification dismissed:', event.notification.tag);
});
