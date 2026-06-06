import { useEffect, useState } from 'react';

export function useTelegram() {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#080d18');
      tg.setBackgroundColor('#080d18');
    }
  }, []);

  const haptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
  };

  const hapticSuccess = () => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const hapticError = () => {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
  };

  return { isTelegram, haptic, hapticSuccess, hapticError };
}
