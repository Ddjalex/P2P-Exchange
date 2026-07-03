import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const DISMISSED_KEY = "telegram_popup_dismissed";
const CHECKED_KEY   = "telegram_popup_checked"; // once per session
const POPUP_DELAY_MS = 4000;

// Paths where the popup must never appear (auth pages and bare home before redirect)
const AUTH_PATHS = ["/", "/auth", "/forgot-password", "/admin"];

function isExcludedPath(path: string) {
  return AUTH_PATHS.some(p => path.startsWith(p));
}

export function TelegramConnectPopup({ userId }: { userId: number }) {
  const [visible, setVisible] = useState(false);
  const [location, setLocation] = useLocation();
  const triggeredRef = useRef(false); // guard: only fire once per mount

  // Force-hide when navigating to excluded paths
  useEffect(() => {
    if (isExcludedPath(location)) setVisible(false);
  }, [location]);

  // Trigger once after login — never repeat on route changes
  useEffect(() => {
    if (triggeredRef.current) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (sessionStorage.getItem(CHECKED_KEY)) return;
    if (isExcludedPath(location)) return;

    triggeredRef.current = true;
    sessionStorage.setItem(CHECKED_KEY, "1");

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("p2p_token");
        const res = await fetch("/api/profile/telegram-status", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data.linked && !cancelled) setVisible(true);
      } catch {
        // network error or aborted — skip silently
      }
    }, POPUP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // only re-run if userId changes (i.e. different user logs in)

  const handleConnect = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setLocation("/profile?tab=notifications");
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  // Never render on excluded paths even if visible was somehow set
  if (!visible || isExcludedPath(location)) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(8,13,24,0.88)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 9996,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "Poppins, sans-serif",
  };

  const card: React.CSSProperties = {
    background: "#0c1420",
    border: "1.5px solid rgba(0,229,255,0.25)",
    borderRadius: "20px",
    padding: "36px 24px 28px",
    maxWidth: "360px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 8px 40px rgba(0,229,255,0.12)",
  };

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Icon */}
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          background: "linear-gradient(135deg,rgba(35,158,218,0.2),rgba(0,229,255,0.1))",
          border: "2px solid rgba(35,158,218,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          margin: "0 auto 20px",
        }}>
          ✈️
        </div>

        <div style={{ color: "#fff", fontSize: "19px", fontWeight: 700, marginBottom: "10px" }}>
          Connect Telegram
        </div>
        <div style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.65, marginBottom: "28px" }}>
          Get instant notifications for orders, KYC updates, withdrawals
          and more — straight to your Telegram.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handleConnect}
            style={{
              background: "linear-gradient(135deg,#00d4ff,#0099cc)",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              color: "#080d18",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              letterSpacing: "0.3px",
            }}
          >
            Connect Telegram →
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              padding: "10px",
              color: "#4a5568",
              fontSize: "13px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
