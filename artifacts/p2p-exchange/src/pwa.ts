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
    if (!granted) return null;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    const reg = await navigator.serviceWorker.ready;

    const vapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      console.log('No VAPID key — push disabled');
      return null;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('p2p_token')}`,
      },
      body: JSON.stringify({ subscription, userId }),
    });

    console.log('Push subscription active');
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}
