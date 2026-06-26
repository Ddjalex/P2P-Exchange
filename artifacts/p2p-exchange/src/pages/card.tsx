import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Eye, EyeOff, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, RefreshCw, CheckCircle, History, Clock } from "lucide-react";

function getToken() {
  return localStorage.getItem("p2p_token") ?? "";
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : (data.message ?? "Request failed");
    throw new Error(msg);
  }
  return data;
}

function CardVisual({
  holderName,
  cardNumber,
  last4,
  cvv,
  expiry,
  balance,
  status,
  blurred,
}: {
  holderName: string;
  cardNumber?: string | null;
  last4?: string | null;
  cvv?: string | null;
  expiry?: string | null;
  balance?: string | null;
  status?: string;
  blurred?: boolean;
}) {
  const [showNumber, setShowNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const isFrozen = status === "inactive" || status === "frozen";
  const isProcessing = status === "processing";

  const accent = isFrozen ? "rgb(120,120,200)" : "rgb(0,229,255)";
  const accentDim = isFrozen ? "rgba(120,120,200,0.6)" : "rgba(0,229,255,0.6)";

  const displayNumber =
    showNumber && cardNumber
      ? cardNumber.replace(/(.{4})/g, "$1 ").trim()
      : last4
      ? `•••• •••• •••• ${last4}`
      : "•••• •••• •••• ••••";

  const balanceDisplay = `$${parseFloat(balance ?? "0").toFixed(2)}`;
  const cvvDisplay = showCvv && cvv ? cvv : "•••";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
      <svg viewBox="0 0 380 275" style={{ width: "100%", borderRadius: "18px", display: "block", filter: blurred ? "blur(4px)" : "none" }}>
        <defs>
          <linearGradient id="cg-cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isFrozen ? "rgb(20,20,40)" : "rgb(10,22,40)"} />
            <stop offset="50%" stopColor={isFrozen ? "rgb(30,20,60)" : "rgb(13,32,64)"} />
            <stop offset="100%" stopColor={isFrozen ? "rgb(20,20,40)" : "rgb(10,22,40)"} />
          </linearGradient>
          <linearGradient id="cg-accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor={isFrozen ? "rgb(60,60,140)" : "rgb(0,136,204)"} />
          </linearGradient>
        </defs>

        {/* Card background */}
        <rect x="0" y="0" width="380" height="275" rx="18" fill="url(#cg-cardGrad)" />
        <rect x="0" y="0" width="380" height="275" rx="18" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.5" />

        {/* Decorative circles */}
        <circle cx="320" cy="55" r="80" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.15" />
        <circle cx="320" cy="55" r="55" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.12" />
        <circle cx="60" cy="175" r="60" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.1" />

        {/* Chip */}
        <rect x="24" y="78" width="44" height="32" rx="5" fill="rgb(255,215,0)" fillOpacity="0.9" />
        <line x1="24" y1="89" x2="68" y2="89" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="24" y1="98" x2="68" y2="98" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="46" y1="78" x2="46" y2="110" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Logo */}
        <text x="24" y="58" fontFamily="Poppins, sans-serif" fontSize="14" fontWeight="800" fill="white">
          xen<tspan fill={accent}>drx</tspan>
        </text>

        {/* Mastercard circles */}
        <circle cx="340" cy="52" r="10" fill="rgb(255,68,68)" fillOpacity="0.8" />
        <circle cx="352" cy="52" r="10" fill="rgb(255,170,0)" fillOpacity="0.8" />
        <circle cx="346" cy="52" r="6" fill="rgb(255,119,0)" fillOpacity="0.6" />

        {/* Card number */}
        <text x="24" y="145" fontFamily="'Courier New', monospace" fontSize="13" fontWeight="600" fill="white" letterSpacing="2">{displayNumber}</text>

        {/* Card holder + Expires */}
        <text x="24" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill={accentDim} letterSpacing="2">CARD HOLDER</text>
        <text x="24" y="192" fontFamily="Poppins, sans-serif" fontSize="12" fontWeight="600" fill="white" letterSpacing="1">
          {holderName.toUpperCase().slice(0, 22)}
        </text>
        <text x="298" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill={accentDim} letterSpacing="2">EXPIRES</text>
        <text x="298" y="192" fontFamily="Poppins, sans-serif" fontSize="12" fontWeight="600" fill="white">{expiry ?? "••/••"}</text>

        {/* Divider */}
        <line x1="12" y1="208" x2="368" y2="208" stroke={accent} strokeWidth="0.5" strokeOpacity="0.25" />

        {/* ── Balance box (static) ── */}
        <rect x="12" y="213" width="108" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
        <text x="66" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">BALANCE</text>
        <text x="66" y="246" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="15" fontWeight="700" fill="white">{balanceDisplay}</text>

        {/* ── CVV box (clickable) ── */}
        <g onClick={() => setShowCvv((v) => !v)} style={{ cursor: "pointer" }}>
          <rect x="128" y="213" width="108" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
          <text x="182" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">CVV</text>
          <text x="182" y="246" textAnchor="middle" fontFamily="'Courier New', monospace" fontSize="15" fontWeight="700" fill="white">{cvvDisplay}</text>
        </g>

        {/* ── PAN toggle box (clickable) ── */}
        <g onClick={() => setShowNumber((v) => !v)} style={{ cursor: "pointer" }}>
          <rect x="244" y="213" width="124" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
          <text x="306" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">FULL PAN</text>
          {/* Eye icon paths */}
          {showNumber ? (
            <g transform="translate(297,232)">
              <ellipse cx="9" cy="7" rx="9" ry="6" fill="none" stroke={accent} strokeWidth="1.5" />
              <circle cx="9" cy="7" r="2.5" fill={accent} />
              <line x1="2" y1="1" x2="16" y2="13" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ) : (
            <g transform="translate(297,232)">
              <ellipse cx="9" cy="7" rx="9" ry="6" fill="none" stroke={accent} strokeWidth="1.5" />
              <circle cx="9" cy="7" r="2.5" fill={accent} />
            </g>
          )}
        </g>

        {/* Bottom accent bar */}
        <rect x="0" y="263" width="380" height="12" rx="0" fill="url(#cg-accentGrad)" opacity="0.6" />
        <rect x="0" y="263" width="380" height="3" fill="url(#cg-accentGrad)" opacity="0.9" />
      </svg>

      {isFrozen && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "18px", background: "rgba(80,0,160,0.25)" }}>
          <div style={{ background: "rgba(200,0,0,0.85)", borderRadius: "8px", padding: "6px 18px", color: "#fff", fontWeight: 700, fontSize: "13px", letterSpacing: "2px" }}>FROZEN</div>
        </div>
      )}
      {isProcessing && !blurred && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "18px", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "rgba(255,170,0,0.9)", borderRadius: "8px", padding: "6px 18px", color: "#1a1a2e", fontWeight: 700, fontSize: "13px", letterSpacing: "2px" }}>PROCESSING</div>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", padding: "16px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#0d1428", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "360px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, marginBottom: "20px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Btn({
  onClick, disabled, children, variant = "primary",
}: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: { background: "#00e5ff", color: "#1a1a2e", border: "none" },
    secondary: { background: "rgba(0,229,255,0.1)", color: "#fff", border: "1px solid rgba(0,229,255,0.3)" },
    danger: { background: "#ff4444", color: "#fff", border: "none" },
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...styles, borderRadius: "12px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, width: "100%", fontFamily: "Poppins, sans-serif" }}
    >
      {children}
    </button>
  );
}

export default function CardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"fund" | "withdraw" | "freeze" | "confirm-create" | null>(null);
  const [amount, setAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const { data: meData } = useQuery({ queryKey: ["me-card"], queryFn: () => apiFetch("/api/auth/me") });
  const { data: cardData, refetch: refetchCard, isFetching: cardFetching, isLoading: cardLoading } = useQuery({
    queryKey: ["my-card"],
    queryFn: () => apiFetch("/api/cards/my-card"),
    refetchInterval: (query) => {
      const c = (query.state.data as any)?.card;
      return c?.card_status === "processing" ? 30000 : false;
    },
  });
  const { data: walletData } = useQuery({ queryKey: ["wallet-card"], queryFn: () => apiFetch("/api/wallet") });
  const { data: historyData } = useQuery({ queryKey: ["card-history"], queryFn: () => apiFetch("/api/cards/history"), enabled: showHistory });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-card"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-card"] });
  };

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/cards/create", { method: "POST" }),
    onSuccess: () => { invalidate(); setModal(null); showToast("Card created! It will be ready in a few minutes."); },
    onError: (e: any) => { setModal(null); showToast(e.message, false); },
  });
  const fundMutation = useMutation({
    mutationFn: (amt: number) => apiFetch("/api/cards/fund", { method: "POST", body: JSON.stringify({ amount: amt }) }),
    onSuccess: () => { invalidate(); setModal(null); setAmount(""); showToast("Card funded successfully!"); },
    onError: (e: any) => showToast(e.message, false),
  });
  const withdrawMutation = useMutation({
    mutationFn: (amt: number) => apiFetch("/api/cards/withdraw", { method: "POST", body: JSON.stringify({ amount: amt }) }),
    onSuccess: () => { invalidate(); setModal(null); setAmount(""); showToast("Withdrawal successful!"); },
    onError: (e: any) => showToast(e.message, false),
  });
  const freezeMutation = useMutation({
    mutationFn: () => apiFetch("/api/cards/freeze", { method: "POST" }),
    onSuccess: (d: any) => { invalidate(); setModal(null); showToast(d.message); },
    onError: (e: any) => { setModal(null); showToast(e.message, false); },
  });

  const kycStatus = meData?.kycStatus;
  const card = (cardData as any)?.card ?? null;
  const walletBalance = parseFloat((walletData as any)?.availableBalance ?? "0");
  const kycName = (meData as any)?.kycFullName ?? (meData as any)?.username ?? "YOUR NAME";
  const isFrozen = card?.card_status === "inactive" || card?.card_status === "frozen";
  const isProcessing = card?.card_status === "processing";
  const isActive = card?.card_status === "active";
  const mutBusy = createMutation.isPending || fundMutation.isPending || withdrawMutation.isPending || freezeMutation.isPending;

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex space-x-4 text-lg">
          <button onClick={() => setLocation("/wallet")} className="text-muted-foreground font-medium">Wallet</button>
          <button onClick={() => setLocation("/p2p")} className="text-muted-foreground font-medium">P2P</button>
          <button className="text-white font-bold">Card</button>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 100px", fontFamily: "Poppins, sans-serif" }}>

        {toast && (
          <div style={{ width: "100%", maxWidth: "380px", marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: toast.ok ? "rgba(0,229,255,0.1)" : "rgba(255,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(0,229,255,0.3)" : "rgba(255,68,68,0.4)"}`, color: toast.ok ? "#00e5ff" : "#ff8888", fontSize: "13px", fontWeight: 500 }}>
            {toast.msg}
          </div>
        )}

        {/* STATE 1 — KYC not verified */}
        {kycStatus !== "verified" && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "24px" }}>
              <CardVisual holderName="COMPLETE KYC" blurred />
            </div>
            <div style={{ width: "100%", maxWidth: "360px", background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)", borderRadius: "16px", padding: "28px", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
              <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>KYC Verification Required</h2>
              <p style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.6, marginBottom: "20px" }}>Please complete your identity verification before getting a card</p>
              <Btn onClick={() => setLocation("/kyc")}>Verify Now</Btn>
            </div>
          </>
        )}

        {/* STATE 2 — KYC verified, no card yet */}
        {kycStatus === "verified" && !card && !cardLoading && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "24px" }}>
              <CardVisual holderName={kycName} />
            </div>
            <h2 style={{ color: "#fff", fontSize: "22px", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>Get Your Xendrx Card</h2>
            <p style={{ color: "#8899aa", fontSize: "13px", textAlign: "center", marginBottom: "24px", lineHeight: 1.6, maxWidth: "280px" }}>
              Virtual Visa card — pay anywhere, Google Pay & Apple Pay supported
            </p>
            <div style={{ width: "100%", maxWidth: "360px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                ["👤", "Verified name", kycName],
                ["💳", "Card creation fee", "$2 USDT"],
                ["💰", "Initial funding loaded", "$3 USDT automatically"],
                ["📋", "Total required", "$5 USDT minimum balance"],
              ].map(([icon, label, value]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.15)", borderRadius: "10px" }}>
                  <span style={{ color: "#8899aa", fontSize: "13px" }}>{icon} {label}</span>
                  <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            {walletBalance < 5 && (
              <p style={{ color: "#ff8888", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                You need $5.00 USDT — you have ${walletBalance.toFixed(2)}. Please deposit first.
              </p>
            )}
            <div style={{ width: "100%", maxWidth: "360px" }}>
              <Btn onClick={() => setModal("confirm-create")} disabled={walletBalance < 5}>Create My Card</Btn>
            </div>
          </>
        )}

        {/* Loading skeleton while card data fetches */}
        {kycStatus === "verified" && cardLoading && (
          <div style={{ width: "100%", maxWidth: "380px", height: "220px", background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: "18px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={22} color="#00e5ff" style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
          </div>
        )}

        {/* STATE 3 — Processing */}
        {kycStatus === "verified" && card && isProcessing && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "24px" }}>
              <CardVisual holderName={card.name_on_card ?? kycName} last4={card.last4} expiry={card.expiry} balance={card.balance} status={card.card_status} />
            </div>
            <div style={{ width: "100%", maxWidth: "360px", background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)", borderRadius: "16px", padding: "24px", textAlign: "center" }}>
              <Clock size={28} color="#ffaa00" style={{ margin: "0 auto 10px" }} />
              <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>Card Being Set Up</h3>
              <p style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.5, marginBottom: "16px" }}>Your card is being set up. This usually takes a few minutes.</p>
              <button
                onClick={() => refetchCard()}
                disabled={cardFetching}
                style={{ background: "rgba(255,170,0,0.15)", border: "1px solid rgba(255,170,0,0.4)", borderRadius: "10px", padding: "10px 20px", color: "#ffaa00", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={14} style={{ animation: cardFetching ? "spin 1s linear infinite" : "none" }} /> Refresh Status
              </button>
            </div>
          </>
        )}

        {/* STATES 4 & 5 — Active / Frozen */}
        {kycStatus === "verified" && card && (isActive || isFrozen) && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "16px" }}>
              <CardVisual
                holderName={card.name_on_card ?? kycName}
                cardNumber={card.card_number}
                last4={card.last4}
                cvv={card.cvv}
                expiry={card.expiry}
                balance={card.balance}
                status={card.card_status}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "20px", background: isFrozen ? "rgba(255,68,68,0.15)" : "rgba(0,229,255,0.1)", border: `1px solid ${isFrozen ? "rgba(255,68,68,0.4)" : "rgba(0,229,255,0.3)"}`, color: isFrozen ? "#ff8888" : "#00e5ff", fontSize: "13px", fontWeight: 600 }}>
                {isFrozen ? <Lock size={13} /> : <CheckCircle size={13} />}
                {isFrozen ? "Frozen" : "Active"}
              </span>
            </div>

            <div style={{ width: "100%", maxWidth: "360px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {[
                { icon: <ArrowUpCircle size={20} color={isFrozen ? "#556677" : "#00e5ff"} />, label: "Fund Card", disabled: isFrozen, onClick: () => { setAmount(""); setModal("fund"); } },
                { icon: <ArrowDownCircle size={20} color={isFrozen ? "#556677" : "#00e5ff"} />, label: "Withdraw", disabled: isFrozen, onClick: () => { setAmount(""); setModal("withdraw"); } },
                { icon: isFrozen ? <Unlock size={20} color="#00e5ff" /> : <Lock size={20} color="#ff6666" />, label: isFrozen ? "Activate" : "Freeze", disabled: false, onClick: () => setModal("freeze") },
                { icon: <History size={20} color="#00e5ff" />, label: "History", disabled: false, onClick: () => setShowHistory((v) => !v) },
              ].map(({ icon, label, disabled, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={disabled}
                  style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "14px", padding: "16px 10px", color: disabled ? "#556677" : "#fff", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "Poppins, sans-serif", opacity: disabled ? 0.5 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
                >
                  {icon}
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{label}</span>
                </button>
              ))}
            </div>

            {showHistory && (
              <div style={{ width: "100%", maxWidth: "380px" }}>
                <h3 style={{ color: "#fff", fontSize: "15px", fontWeight: 700, marginBottom: "12px" }}>Transaction History</h3>
                {!historyData ? (
                  <p style={{ color: "#8899aa", textAlign: "center", padding: "20px" }}>Loading…</p>
                ) : ((historyData as any).transactions ?? []).length === 0 ? (
                  <p style={{ color: "#8899aa", textAlign: "center", padding: "20px", fontSize: "13px" }}>No transactions yet</p>
                ) : (
                  ((historyData as any).transactions ?? []).map((tx: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", marginBottom: "8px", background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: "12px" }}>
                      <div>
                        <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{tx.description ?? tx.narration ?? "Transaction"}</div>
                        <div style={{ color: "#8899aa", fontSize: "11px", marginTop: "2px" }}>{tx.date ?? tx.created_at ?? ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: tx.type === "credit" ? "#00e5ff" : "#ff6666", fontSize: "13px", fontWeight: 700 }}>
                          {tx.type === "credit" ? "+" : "-"}${parseFloat(tx.amount ?? "0").toFixed(2)}
                        </div>
                        <div style={{ color: "#556677", fontSize: "11px", textTransform: "capitalize" }}>{tx.status ?? ""}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}

      {modal === "confirm-create" && (
        <Modal title="Create Your Xendrx Card" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {[["Card for", kycName], ["Creation fee", "$2 USDT deducted"], ["Auto-loaded", "$3 USDT on card"], ["Your balance", `$${walletBalance.toFixed(2)} USDT`]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,229,255,0.05)", borderRadius: "10px" }}>
                <span style={{ color: "#8899aa", fontSize: "13px" }}>{l}</span>
                <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={() => createMutation.mutate()} disabled={mutBusy}>{createMutation.isPending ? "Creating…" : "Confirm"}</Btn>
          </div>
        </Modal>
      )}

      {modal === "fund" && (
        <Modal title="Fund Card" onClose={() => setModal(null)}>
          <p style={{ color: "#8899aa", fontSize: "13px", marginBottom: "16px" }}>
            Platform balance: <strong style={{ color: "#00e5ff" }}>${walletBalance.toFixed(2)} USDT</strong>
          </p>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USDT" min="1"
            style={{ width: "100%", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "12px", color: "#fff", fontSize: "15px", marginBottom: "16px", boxSizing: "border-box", fontFamily: "Poppins, sans-serif", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={() => fundMutation.mutate(parseFloat(amount))} disabled={mutBusy || !amount || parseFloat(amount) <= 0}>
              {fundMutation.isPending ? "Funding…" : "Fund Card"}
            </Btn>
          </div>
        </Modal>
      )}

      {modal === "withdraw" && (
        <Modal title="Withdraw from Card" onClose={() => setModal(null)}>
          <p style={{ color: "#8899aa", fontSize: "13px", marginBottom: "16px" }}>
            Card balance: <strong style={{ color: "#00e5ff" }}>${parseFloat(card?.balance ?? "0").toFixed(2)} USDT</strong>
          </p>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USDT" min="1"
            style={{ width: "100%", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "12px", color: "#fff", fontSize: "15px", marginBottom: "16px", boxSizing: "border-box", fontFamily: "Poppins, sans-serif", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={() => withdrawMutation.mutate(parseFloat(amount))} disabled={mutBusy || !amount || parseFloat(amount) <= 0}>
              {withdrawMutation.isPending ? "Withdrawing…" : "Withdraw"}
            </Btn>
          </div>
        </Modal>
      )}

      {modal === "freeze" && (
        <Modal title={isFrozen ? "Activate Card" : "Freeze Card"} onClose={() => setModal(null)}>
          <p style={{ color: "#8899aa", fontSize: "14px", marginBottom: "20px", lineHeight: 1.6 }}>
            {isFrozen
              ? "Activate your card to start making payments again."
              : "Freeze your card to block all payments immediately."}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant={isFrozen ? "primary" : "danger"} onClick={() => freezeMutation.mutate()} disabled={mutBusy}>
              {freezeMutation.isPending ? "Please wait…" : isFrozen ? "Activate" : "Freeze"}
            </Btn>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
