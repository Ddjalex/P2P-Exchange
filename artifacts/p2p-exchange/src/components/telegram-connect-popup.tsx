import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const DISMISSED_KEY = "telegram_popup_dismissed";
const CHECKED_KEY   = "telegram_popup_checked"; // once per session
const POPUP_DELAY_MS = 4000;

// Exact paths (or prefixes) where the popup must never appear
const EXCLUDED_EXACT = new Set(["/"]); // home redirect — not a real in-app route
const EXCLUDED_PREFIXES = ["/auth", "/forgot-password", "/admin"];

function isExcludedPath(path: string) {
  if (EXCLUDED_EXACT.has(path)) return true;
  return EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(p + "/"));
}

function getToken() {
  return localStorage.getItem("p2p_token");
}

export function TelegramConnectPopup({ userId }: { userId: number }) {
  const [visible, setVisible] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [location] = useLocation();
  const triggeredRef = useRef(false);

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
        const token = getToken();
        const [statusRes, configRes] = await Promise.all([
          fetch("/api/profile/telegram-status", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
          fetch("/api/config/telegram", { signal: controller.signal }),
        ]);
        if (cancelled) return;
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (!data.linked && !cancelled) setVisible(true);
        }
        if (configRes.ok) {
          const cfg = await configRes.json();
          setBotUsername(cfg.botUsername ?? null);
        }
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
  }, [userId]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/telegram-link-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok && data.code) {
        const bot = botUsername ?? "xendrx_bot";
        const deepLink = `https://t.me/${bot}?start=${data.code}`;
        window.open(deepLink, "_blank", "noopener,noreferrer");
      }
    } catch {
      // fallback: just open the bot
      window.open(`https://t.me/${botUsername ?? "xendrx_bot"}`, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
      setVisible(false);
      sessionStorage.setItem(DISMISSED_KEY, "1");
    }
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
            disabled={loading}
            style={{
              background: loading ? "rgba(0,212,255,0.5)" : "linear-gradient(135deg,#00d4ff,#0099cc)",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              color: "#080d18",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              letterSpacing: "0.3px",
            }}
          >
            {loading ? "Opening Telegram…" : "Connect Telegram →"}
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
