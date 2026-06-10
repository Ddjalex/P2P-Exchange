import { useState, useEffect } from 'react';
import { requestNotificationPermission, subscribeToPush } from '@/pwa';

export function NotificationPermissionBanner({ userId }: { userId: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => setShow(true), 4000);
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
      {/* Bell icon */}
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
