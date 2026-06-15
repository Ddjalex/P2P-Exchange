import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (e) {
    console.error('SW registration failed:', e);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(userId: number): Promise<PushSubscription | null> {
  try {
    const granted = await requestNotificationPermission();
    console.log('[Push] Permission granted:', granted);
    if (!granted) return null;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] ServiceWorker or PushManager not available');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] SW ready, subscribing...');

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      console.warn('[Push] No VAPID key (VITE_VAPID_PUBLIC_KEY not set) — push disabled');
      return null;
    }
    console.log('[Push] VAPID key present, length:', vapidKey.length);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    console.log('[Push] Subscription created:', JSON.stringify(subscription));

    const token = localStorage.getItem('p2p_token');
    console.log('[Push] Saving subscription to /api/push/subscribe...');

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription, userId }),
    });

    const result = await response.json().catch(() => ({}));
    console.log('[Push] Server response:', result);

    if (!response.ok) {
      console.error('[Push] API save failed:', response.status, result);
      showPushErrorToast(`Push save failed (${response.status}): ${JSON.stringify(result)}`);
    } else {
      console.log('[Push] Subscription saved successfully:', result);
      toast.success('✅ Push notifications enabled!', {
        description: "You'll receive trade and payment alerts even when the app is closed.",
        duration: 4000,
      });
    }

    return subscription;
  } catch (error) {
    console.error('[Push] subscribeToPush error:', error);
    showPushErrorToast(String(error));
    return null;
  }
}

function showPushErrorToast(message: string) {
  try {
    const div = document.createElement('div');
    div.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:#7f1d1d', 'color:#fecaca', 'padding:10px 16px', 'border-radius:8px',
      'font-size:12px', 'max-width:320px', 'z-index:99999', 'text-align:center',
      'font-family:Poppins,sans-serif', 'line-height:1.4',
    ].join(';');
    div.textContent = `Push error: ${message}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  } catch (_) { /* ignore */ }
}
