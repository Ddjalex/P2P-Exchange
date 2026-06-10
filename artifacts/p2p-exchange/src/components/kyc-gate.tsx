import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, Clock, ShieldX, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const GATE_CONFIG = {
  none: {
    icon: ShieldCheck,
    title: "Identity Verification Required",
    description: "Complete your KYC to access the wallet, P2P market, ads, and orders.",
    ctaLabel: "Start Verification",
    ctaHref: "/kyc",
    bannerText: "⚠️ Complete KYC to unlock trading",
    bannerColor: "#00d4ff",
  },
  pending: {
    icon: Clock,
    title: "Verification Under Review",
    description: "Your documents have been submitted and are being reviewed by our team. Usually takes 1–2 business days.",
    ctaLabel: "View KYC Status",
    ctaHref: "/kyc",
    bannerText: "⏳ Your KYC is under review",
    bannerColor: "#f0c040",
  },
  rejected: {
    icon: ShieldX,
    title: "Verification Rejected",
    description: "Your KYC submission was rejected. Please resubmit with clear, valid documents. Contact support if you need help.",
    ctaLabel: "Resubmit Documents",
    ctaHref: "/kyc",
    bannerText: "❌ KYC rejected — resubmit to continue",
    bannerColor: "#ff5555",
  },
  more_info_required: {
    icon: AlertTriangle,
    title: "Additional Information Required",
    description: "Our team needs more information to complete your verification. Please update your submission.",
    ctaLabel: "Update Submission",
    ctaHref: "/kyc",
    bannerText: "⚠️ KYC update required to trade",
    bannerColor: "#f07020",
  },
} as const;

export function KycGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Verified (or no user) — render normally
  if (!user || user.kycStatus === "verified") {
    return <>{children}</>;
  }

  const status = user.kycStatus as keyof typeof GATE_CONFIG;
  const cfg = GATE_CONFIG[status] ?? GATE_CONFIG.none;
  const Icon = cfg.icon;

  return (
    <>
      {/* Page content renders fully visible — users can browse freely */}
      {children}

      {/* Transparent overlay at z-40: intercepts any click on page content and shows the KYC modal.
          The bottom nav is rendered at z-50 so it remains clickable above this overlay —
          users can freely navigate between pages using the bottom nav. */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 40, cursor: "pointer" }}
        onClick={() => setShowModal(true)}
        aria-hidden="true"
      />

      {/* KYC status banner — sits just above the bottom nav (nav height = 64px) */}
      <div
        className="fixed left-0 right-0 sm:max-w-[480px] sm:mx-auto"
        style={{
          bottom: 64,
          zIndex: 51,
          background: "rgba(8,13,24,0.97)",
          borderTop: `1px solid ${cfg.bannerColor}55`,
          padding: "9px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(8px)",
        }}
      >
        <span style={{ color: cfg.bannerColor, fontSize: 12, fontWeight: 600, fontFamily: "Poppins,sans-serif" }}>
          {cfg.bannerText}
        </span>
        <Link href={cfg.ctaHref}>
          <button
            style={{
              color: "#00d4ff",
              fontSize: 11,
              background: "none",
              border: "1px solid rgba(0,212,255,0.35)",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontFamily: "Poppins,sans-serif",
            }}
          >
            {cfg.ctaLabel}
          </button>
        </Link>
      </div>

      {/* KYC action modal — z-[9999] appears on top of everything */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#0c1420",
              border: "1.5px solid rgba(0,212,255,0.18)",
              borderRadius: 22,
              padding: 28,
              maxWidth: 340,
              width: "100%",
              fontFamily: "Poppins,sans-serif",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: `${cfg.bannerColor}15`,
                border: `1.5px solid ${cfg.bannerColor}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <Icon style={{ width: 28, height: 28, color: cfg.bannerColor }} />
              </div>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: "0 0 8px" }}>
                {cfg.title}
              </h3>
              <p style={{ color: "#8899aa", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                {cfg.description}
              </p>
            </div>

            <Link href={cfg.ctaHref}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "#00d4ff",
                  color: "#0a0e1a",
                  fontWeight: 700,
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  marginBottom: 8,
                  display: "block",
                }}
              >
                {cfg.ctaLabel}
              </button>
            </Link>
            <button
              onClick={() => setShowModal(false)}
              style={{
                width: "100%",
                padding: "11px",
                background: "none",
                color: "#8899aa",
                border: "1px solid #1e2d40",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
