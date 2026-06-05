import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";

function CardSvg() {
  return (
    <svg viewBox="0 0 380 220" style={{ width: "100%", borderRadius: "18px", display: "block" }}>
      <defs>
        <linearGradient id="cg-cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(10,22,40)" />
          <stop offset="50%" stopColor="rgb(13,32,64)" />
          <stop offset="100%" stopColor="rgb(10,22,40)" />
        </linearGradient>
        <linearGradient id="cg-cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(0,212,255)" />
          <stop offset="100%" stopColor="rgb(0,136,204)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="380" height="220" rx="18" fill="url(#cg-cardGrad)" />
      <rect x="0" y="0" width="380" height="220" rx="18" fill="none" stroke="rgb(0,212,255)" strokeWidth="1" strokeOpacity="0.5" />

      <circle cx="320" cy="55" r="80" fill="none" stroke="rgb(0,212,255)" strokeWidth="0.5" strokeOpacity="0.15" />
      <circle cx="320" cy="55" r="55" fill="none" stroke="rgb(0,212,255)" strokeWidth="0.5" strokeOpacity="0.12" />
      <circle cx="320" cy="55" r="30" fill="rgb(0,212,255)" fillOpacity="0.06" />
      <circle cx="60" cy="175" r="60" fill="none" stroke="rgb(0,212,255)" strokeWidth="0.5" strokeOpacity="0.1" />

      <line x1="0" y1="145" x2="380" y2="85" stroke="rgb(0,212,255)" strokeWidth="0.4" strokeOpacity="0.12" />
      <line x1="0" y1="165" x2="380" y2="105" stroke="rgb(0,212,255)" strokeWidth="0.4" strokeOpacity="0.08" />

      <rect x="24" y="78" width="44" height="32" rx="5" fill="rgb(255,215,0)" fillOpacity="0.9" />
      <line x1="24" y1="89" x2="68" y2="89" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="24" y1="98" x2="68" y2="98" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="46" y1="78" x2="46" y2="110" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />

      <path d="M82,86 Q88,94 82,102" fill="none" stroke="rgb(0,212,255)" strokeWidth="1.5" strokeOpacity="0.7" />
      <path d="M86,82 Q96,94 86,106" fill="none" stroke="rgb(0,212,255)" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M90,78 Q104,94 90,110" fill="none" stroke="rgb(0,212,255)" strokeWidth="1.5" strokeOpacity="0.3" />

      <text x="24" y="58" fontFamily="Poppins, sans-serif" fontSize="14" fontWeight="800" fill="white">
        Ethio<tspan fill="rgb(0,212,255)">P2P</tspan>
      </text>

      <text x="334" y="42" textAnchor="end" fontFamily="Poppins, sans-serif" fontSize="11" fontWeight="700" fill="white" fillOpacity="0.6">CRYPTO</text>
      <circle cx="340" cy="52" r="10" fill="rgb(255,68,68)" fillOpacity="0.8" />
      <circle cx="352" cy="52" r="10" fill="rgb(255,170,0)" fillOpacity="0.8" />
      <circle cx="346" cy="52" r="6" fill="rgb(255,119,0)" fillOpacity="0.6" />

      <text x="24" y="145" fontFamily="'Courier New', monospace" fontSize="15" fontWeight="600" fill="white" letterSpacing="3">4521  ••••  ••••  8842</text>

      <text x="24" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill="rgb(0,212,255)" fillOpacity="0.7" letterSpacing="2">CARD HOLDER</text>
      <text x="24" y="192" fontFamily="Poppins, sans-serif" fontSize="13" fontWeight="600" fill="white" letterSpacing="1">ALMESEGED WONDIMU</text>

      <text x="298" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill="rgb(0,212,255)" fillOpacity="0.7" letterSpacing="2">EXPIRES</text>
      <text x="298" y="192" fontFamily="Poppins, sans-serif" fontSize="13" fontWeight="600" fill="white">12/28</text>

      <rect x="0" y="208" width="380" height="12" rx="0" fill="url(#cg-cyanGrad)" opacity="0.6" />
      <rect x="0" y="208" width="380" height="3" fill="url(#cg-cyanGrad)" opacity="0.9" />
    </svg>
  );
}

export default function CardPage() {
  const [, setLocation] = useLocation();
  const [notified, setNotified] = useState(false);

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex space-x-4 text-lg">
          <button onClick={() => setLocation("/wallet")} className="text-muted-foreground font-medium">Wallet</button>
          <button onClick={() => setLocation("/p2p")} className="text-muted-foreground font-medium">P2P</button>
          <button className="text-white font-bold">Card</button>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "24px 20px 100px",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px", marginBottom: "32px" }}>
          <CardSvg />
        </div>

        <h2 style={{ color: "#ffffff", fontSize: "28px", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
          Coming Soon
        </h2>
        <p style={{ color: "#8899aa", fontSize: "14px", textAlign: "center", marginBottom: "32px", lineHeight: "1.6", maxWidth: "280px" }}>
          The EthioP2P Card is on its way. Pay anywhere, buy crypto instantly, and earn cashback on every transaction.
        </p>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "32px" }}>
          {["💳 Buy Crypto", "🔄 P2P Pay", "💰 Cashback", "🔒 Secure", "⚡ Instant"].map((f) => (
            <span
              key={f}
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: "20px",
                padding: "6px 14px",
                color: "#00d4ff",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {!notified ? (
          <button
            onClick={() => setNotified(true)}
            style={{
              width: "100%",
              maxWidth: "300px",
              height: "50px",
              background: "#00d4ff",
              border: "none",
              borderRadius: "25px",
              color: "#1a1a2e",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔔 Notify Me When Available
          </button>
        ) : (
          <div
            style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.3)",
              borderRadius: "12px",
              padding: "16px 24px",
              textAlign: "center",
              maxWidth: "300px",
            }}
          >
            <p style={{ color: "#00d4ff", fontSize: "15px", fontWeight: 700, margin: 0 }}>✅ You're on the list!</p>
            <p style={{ color: "#8899aa", fontSize: "12px", margin: "4px 0 0" }}>
              We'll notify you when the card launches
            </p>
          </div>
        )}

        <p style={{ color: "#556677", fontSize: "11px", textAlign: "center", marginTop: "24px" }}>
          EthioP2P Card — Powered by blockchain technology
        </p>
      </div>
    </AppLayout>
  );
}
