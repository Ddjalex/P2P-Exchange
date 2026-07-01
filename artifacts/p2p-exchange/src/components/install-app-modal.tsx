import { useState, useEffect } from "react";
import { getInstallPrompt, clearInstallPrompt, isAppInstalled } from "@/pwa";

const INSTALL_KEY = "pwa_install_dismissed";
const SHARE_KEY   = "share_modal_shown"; // sessionStorage — resets each login session

const APP_URL = "https://xendrx.com";

// ── Shared styles ──────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,13,24,0.92)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  zIndex: 9997,
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
  padding: "32px 24px",
  maxWidth: "380px",
  width: "100%",
  textAlign: "center",
  boxShadow: "0 8px 40px rgba(0,229,255,0.12)",
};

const primaryBtn: React.CSSProperties = {
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
};

const ghostBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #1e2d3d",
  borderRadius: "12px",
  padding: "11px",
  color: "#4a5568",
  fontSize: "13px",
  cursor: "pointer",
  width: "100%",
};

function AppIcon() {
  return (
    <div style={{
      width: "80px", height: "80px",
      borderRadius: "20px",
      background: "rgba(0,229,255,0.08)",
      border: "2px solid rgba(0,229,255,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 20px",
      overflow: "hidden",
    }}>
      <img
        src="/icons/icon-192x192.png"
        alt="Xendrx"
        style={{ width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

// ── Install Modal ──────────────────────────────────────────────────────────

function InstallModal({ onDone }: { onDone: () => void }) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        clearInstallPrompt();
        localStorage.setItem(INSTALL_KEY, "1");
      }
    } catch {
      // user dismissed native dialog
    } finally {
      setInstalling(false);
      onDone();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(INSTALL_KEY, "1");
    onDone();
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <AppIcon />
        <div style={{ color: "#fff", fontSize: "19px", fontWeight: 700, marginBottom: "8px" }}>
          Install Xendrx App
        </div>
        <div style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.65, marginBottom: "28px" }}>
          Add Xendrx to your home screen for the best experience — opens instantly
          and feels just like a native app.
        </div>

        <div style={{
          background: "#0a0f1c",
          border: "1px solid #1e2d3d",
          borderRadius: "12px",
          padding: "14px 16px",
          textAlign: "left",
          marginBottom: "24px",
        }}>
          {[
            { icon: "⚡", text: "Opens instantly from your home screen" },
            { icon: "📴", text: "Works even with poor connection" },
            { icon: "🖥️", text: "Full-screen, no browser chrome" },
          ].map(({ icon, text }, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "10px",
              color: "#aab4c0", fontSize: "12px",
              marginBottom: i < 2 ? "10px" : 0, lineHeight: 1.5,
            }}>
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={handleInstall} disabled={installing} style={{
            ...primaryBtn,
            opacity: installing ? 0.7 : 1,
            cursor: installing ? "not-allowed" : "pointer",
          }}>
            {installing ? "Installing…" : "Install App"}
          </button>
          <button onClick={handleDismiss} style={ghostBtn}>
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ────────────────────────────────────────────────────────────

function ShareModal({ onDone }: { onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Xendrx — P2P Crypto Exchange",
        text: "Buy and sell USDT instantly with Ethiopian Birr. Fast, secure, peer-to-peer.",
        url: APP_URL,
      });
    } catch {
      // user cancelled share sheet — that's fine
    }
    onDone();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
      setTimeout(onDone, 1200);
    } catch {
      onDone();
    }
  };

  const shareOptions = [
    {
      label: "WhatsApp",
      icon: "💬",
      href: `https://wa.me/?text=${encodeURIComponent("Buy and sell USDT instantly with Ethiopian Birr 🇪🇹\n" + APP_URL)}`,
    },
    {
      label: "Telegram",
      icon: "✈️",
      href: `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent("Buy and sell USDT instantly with Ethiopian Birr 🇪🇹 — Xendrx P2P Exchange")}`,
    },
    {
      label: "X / Twitter",
      icon: "🐦",
      href: `https://x.com/intent/tweet?text=${encodeURIComponent("Buy and sell USDT with Ethiopian Birr 🇪🇹 — fast, secure, P2P. " + APP_URL)}`,
    },
  ];

  return (
    <div style={overlay}>
      <div style={card}>
        <AppIcon />

        {/* Celebration badge */}
        <div style={{
          display: "inline-block",
          background: "rgba(0,229,255,0.1)",
          border: "1px solid rgba(0,229,255,0.3)",
          borderRadius: "20px",
          padding: "4px 14px",
          color: "#00e5ff",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.5px",
          marginBottom: "12px",
        }}>
          ✓ App Installed
        </div>

        <div style={{ color: "#fff", fontSize: "19px", fontWeight: 700, marginBottom: "8px" }}>
          Share Xendrx
        </div>
        <div style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.65, marginBottom: "24px" }}>
          Know someone who trades USDT in Ethiopia?<br />
          Help them discover a faster way to buy and sell.
        </div>

        {/* Quick share buttons */}
        {canShare ? (
          <button onClick={handleShare} style={{ ...primaryBtn, marginBottom: "10px" }}>
            📤 Share Xendrx
          </button>
        ) : (
          <div style={{
            display: "flex", gap: "10px", justifyContent: "center",
            marginBottom: "16px",
          }}>
            {shareOptions.map(({ label, icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimeout(onDone, 400)}
                style={{
                  flex: 1,
                  background: "#0a0f1c",
                  border: "1px solid #1e2d3d",
                  borderRadius: "12px",
                  padding: "12px 6px",
                  color: "#c0d0e0",
                  fontSize: "11px",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "20px" }}>{icon}</span>
                {label}
              </a>
            ))}
          </div>
        )}

        {/* Copy link row */}
        <div style={{
          display: "flex",
          background: "#0a0f1c",
          border: "1px solid #1e2d3d",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "12px",
        }}>
          <div style={{
            flex: 1,
            padding: "11px 14px",
            color: "#4a5568",
            fontSize: "12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {APP_URL}
          </div>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "rgba(0,229,255,0.15)" : "rgba(0,229,255,0.08)",
              border: "none",
              borderLeft: "1px solid #1e2d3d",
              padding: "11px 16px",
              color: copied ? "#00e5ff" : "#6a7a8a",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <button onClick={onDone} style={ghostBtn}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────

export function InstallAppModal() {
  const [mode, setMode] = useState<"install" | "share" | "hidden">("hidden");

  useEffect(() => {
    const delay = setTimeout(() => {
      if (isAppInstalled()) {
        // Already installed — show share prompt once per session
        if (!sessionStorage.getItem(SHARE_KEY)) {
          sessionStorage.setItem(SHARE_KEY, "1");
          setMode("share");
        }
        return;
      }

      // Not installed — show install prompt if available and not dismissed
      if (localStorage.getItem(INSTALL_KEY)) return;
      if (getInstallPrompt()) setMode("install");
    }, 2500);

    // Also catch delayed beforeinstallprompt (slow browsers)
    const onPrompt = () => {
      if (!isAppInstalled() && !localStorage.getItem(INSTALL_KEY)) {
        setMode("install");
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      clearTimeout(delay);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const hide = () => setMode("hidden");

  if (mode === "install") return <InstallModal onDone={hide} />;
  if (mode === "share")   return <ShareModal onDone={hide} />;
  return null;
}
