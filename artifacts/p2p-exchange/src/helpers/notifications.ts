export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(880, 0, 0.15, 0.3);
    playTone(1100, 0.18, 0.2, 0.2);
  } catch {
    // silent fail
  }
}

export function vibrateDevice(pattern: number[] = [100, 50, 100]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // silent fail
  }
}

export function triggerNotification(type: "message" | "order") {
  if (type === "message") {
    playNotificationSound();
    vibrateDevice([80]);
  } else {
    playNotificationSound();
    vibrateDevice([100, 50, 100]);
  }
}
