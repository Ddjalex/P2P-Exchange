import { useState, useEffect } from 'react';
import { requestNotificationPermission, subscribeToPush } from '@/pwa';

interface Props {
  userId: number;
}

export function NotificationPermissionModal({ userId }: Props) {
  const [visible, setVisible] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') return;

    if (Notification.permission === 'denied') {
      if (!sessionStorage.getItem('notif_denied_dismissed')) {
        setDenied(true);
        setVisible(true);
      }
      return;
    }

    if (!sessionStorage.getItem('notif_modal_deferred')) {
      setVisible(true);
    }
  }, []);

  const handleEnable = async () => {
    setVisible(false);
    const granted = await subscribeToPush(userId);
    if (granted === null && 'Notification' in window && Notification.permission === 'denied') {
      setDenied(true);
      setVisible(true);
    }
  };

  const handleLater = () => {
    sessionStorage.setItem('notif_modal_deferred', '1');
    setVisible(false);
  };

  const handleDeniedDismiss = () => {
    sessionStorage.setItem('notif_denied_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,13,24,0.92)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'Poppins, sans-serif',
  };

  const card: React.CSSProperties = {
    background: '#0c1420',
    border: '1.5px solid rgba(0,229,255,0.25)',
    borderRadius: '20px',
    padding: '32px 24px',
    maxWidth: '380px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,229,255,0.12)',
  };

  if (denied) {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔕</div>
          <div style={{ color: '#fff', fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>
            Notifications Blocked
          </div>
          <div style={{ color: '#8899aa', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
            You've blocked notifications in your browser. To re-enable:
          </div>
          <div style={{
            background: '#0a0f1c',
            border: '1px solid #1e2d3d',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'left',
            marginBottom: '24px',
          }}>
            {[
              '1. Click the 🔒 lock icon in your browser address bar',
              '2. Find "Notifications" in the site settings',
              '3. Change it to "Allow"',
              '4. Reload the page',
            ].map((step, i) => (
              <div key={i} style={{ color: '#aab4c0', fontSize: '12px', marginBottom: i < 3 ? '8px' : 0, lineHeight: 1.5 }}>
                {step}
              </div>
            ))}
          </div>
          <button onClick={handleDeniedDismiss} style={{
            width: '100%',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.3)',
            borderRadius: '12px',
            padding: '12px',
            color: '#00e5ff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{
          width: '72px', height: '72px',
          borderRadius: '50%',
          background: 'rgba(0,229,255,0.1)',
          border: '2px solid rgba(0,229,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '34px',
          margin: '0 auto 20px',
          animation: 'bell-ring 1.5s ease-in-out infinite',
        }}>
          🔔
        </div>
        <div style={{ color: '#fff', fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
          Enable Notifications
        </div>
        <div style={{ color: '#8899aa', fontSize: '13px', lineHeight: 1.65, marginBottom: '28px' }}>
          Enable notifications to receive <strong style={{ color: '#c0d0e0' }}>order requests</strong>,{' '}
          <strong style={{ color: '#c0d0e0' }}>chat messages</strong>, and{' '}
          <strong style={{ color: '#c0d0e0' }}>payment alerts</strong> in real time.
          <br /><br />
          Without this, you may miss trades even when this tab is closed.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={handleEnable} style={{
            background: 'linear-gradient(135deg,#00d4ff,#0099cc)',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            color: '#080d18',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            letterSpacing: '0.3px',
          }}>
            Enable Notifications
          </button>
          <button onClick={handleLater} style={{
            background: 'none',
            border: '1px solid #1e2d3d',
            borderRadius: '12px',
            padding: '11px',
            color: '#4a5568',
            fontSize: '13px',
            cursor: 'pointer',
            width: '100%',
          }}>
            Maybe Later
          </button>
        </div>
      </div>
      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0deg); }
          10%      { transform: rotate(12deg); }
          20%      { transform: rotate(-10deg); }
          30%      { transform: rotate(8deg); }
          40%      { transform: rotate(-6deg); }
          50%      { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
