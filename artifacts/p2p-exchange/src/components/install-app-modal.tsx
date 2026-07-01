import { useState, useEffect } from "react";
import { getInstallPrompt, clearInstallPrompt, isAppInstalled } from "@/pwa";

const STORAGE_KEY = "pwa_install_dismissed";

export function InstallAppModal() {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if: already installed, already dismissed, or no prompt available
    if (isAppInstalled()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Wait a moment after login so the user lands on the wallet page first
    const delay = setTimeout(() => {
      if (getInstallPrompt()) setVisible(true);
    }, 2500);

    // Also listen in case the prompt fires after we mount (slow browsers)
    const onPrompt = () => {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      clearTimeout(delay);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        clearInstallPrompt();
        localStorage.setItem(STORAGE_KEY, "1");
      }
    } catch {
      // ignore
    } finally {
      setInstalling(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

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

  return (
    <div style={overlay}>
      <div style={card}>
        {/* App icon */}
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

        <div style={{ color: "#fff", fontSize: "19px", fontWeight: 700, marginBottom: "8px" }}>
          Install Xendrx App
        </div>
        <div style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.65, marginBottom: "28px" }}>
          Add Xendrx to your home screen for the best experience — works offline, opens instantly,
          and feels just like a native app.
        </div>

        {/* Feature bullets */}
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
            { icon: "🔔", text: "Full-screen, no browser chrome" },
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
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              background: "linear-gradient(135deg,#00d4ff,#0099cc)",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              color: "#080d18",
              fontSize: "15px",
              fontWeight: 700,
              cursor: installing ? "not-allowed" : "pointer",
              width: "100%",
              letterSpacing: "0.3px",
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? "Installing…" : "Install App"}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "1px solid #1e2d3d",
              borderRadius: "12px",
              padding: "11px",
              color: "#4a5568",
              fontSize: "13px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
