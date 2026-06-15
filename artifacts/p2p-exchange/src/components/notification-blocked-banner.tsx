import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

export function NotificationBlockedBanner() {
  const [denied, setDenied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "denied") setDenied(true);
  }, []);

  if (!denied || dismissed) return null;

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const chromeSteps = [
    "Tap the ⋮ menu (top-right) → Settings",
    "Go to Site Settings → Notifications",
    'Find this site and tap "Allow"',
    "Reload the page",
  ];

  const safariSteps = [
    "Open the iPhone Settings app",
    "Scroll down and tap Safari",
    "Tap Notifications → find this website",
    'Set to "Allow" then reload the page',
  ];

  const steps = isIOS ? safariSteps : chromeSteps;
  const browserLabel = isIOS ? "Safari" : "Chrome";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 51,
        fontFamily: "Poppins, sans-serif",
        background: "linear-gradient(90deg, #1a0a00 0%, #2a1000 100%)",
        borderBottom: "1.5px solid rgba(255,160,0,0.35)",
        boxShadow: "0 2px 12px rgba(255,120,0,0.15)",
      }}
    >
      {/* Banner row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 14px",
          gap: "8px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: "16px", flexShrink: 0 }}>🔔</span>
        <span
          style={{
            flex: 1,
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#ffb347",
            lineHeight: 1.4,
          }}
        >
          Notifications are blocked.{" "}
          <span style={{ textDecoration: "underline", opacity: 0.85 }}>
            Tap to see how to enable them.
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {expanded ? (
            <ChevronUp style={{ width: 14, height: 14, color: "#ffb347" }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14, color: "#ffb347" }} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            style={{
              background: "none",
              border: "none",
              padding: "2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Dismiss"
          >
            <X style={{ width: 14, height: 14, color: "rgba(255,179,71,0.6)" }} />
          </button>
        </div>
      </div>

      {/* Expanded instructions */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid rgba(255,160,0,0.15)",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              borderRadius: "10px",
              padding: "12px",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "rgba(255,179,71,0.7)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {browserLabel} — How to enable
            </div>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: i < steps.length - 1 ? "8px" : 0,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(255,160,0,0.2)",
                    border: "1px solid rgba(255,160,0,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#ffb347",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "12px", color: "#c8a870", lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
