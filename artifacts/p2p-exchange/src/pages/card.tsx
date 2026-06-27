import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Eye, EyeOff, ArrowUpCircle, Lock, Unlock, RefreshCw, CheckCircle, History, Clock, Copy, AlertTriangle, Trash2 } from "lucide-react";

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
    const raw = data.error ?? data.message ?? "Request failed";
    throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw));
  }
  return data;
}

function CardVisual({
  holderName, cardNumber, last4, cvv, expiry, balance, status, blurred,
}: {
  holderName: string; cardNumber?: string | null; last4?: string | null; cvv?: string | null;
  expiry?: string | null; balance?: string | null; status?: string; blurred?: boolean;
}) {
  const [showNumber, setShowNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const isFrozen = status === "inactive" || status === "frozen";
  const isProcessing = status === "processing";
  const accent = isFrozen ? "rgb(120,120,200)" : "rgb(0,229,255)";
  const accentDim = isFrozen ? "rgba(120,120,200,0.6)" : "rgba(0,229,255,0.6)";
  const displayNumber = showNumber && cardNumber
    ? cardNumber.replace(/(.{4})/g, "$1 ").trim()
    : last4 ? `•••• •••• •••• ${last4}` : "•••• •••• •••• ••••";
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
        <rect x="0" y="0" width="380" height="275" rx="18" fill="url(#cg-cardGrad)" />
        <rect x="0" y="0" width="380" height="275" rx="18" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="320" cy="55" r="80" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.15" />
        <circle cx="320" cy="55" r="55" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.12" />
        <circle cx="60" cy="175" r="60" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.1" />
        <rect x="24" y="78" width="44" height="32" rx="5" fill="rgb(255,215,0)" fillOpacity="0.9" />
        <line x1="24" y1="89" x2="68" y2="89" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="24" y1="98" x2="68" y2="98" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="46" y1="78" x2="46" y2="110" stroke="rgb(170,136,0)" strokeWidth="0.8" strokeOpacity="0.5" />
        <text x="24" y="58" fontFamily="Poppins, sans-serif" fontSize="14" fontWeight="800" fill="white">xen<tspan fill={accent}>drx</tspan></text>
        <image href="/visa-logo.png" x="300" y="28" width="68" height="44" preserveAspectRatio="xMidYMid meet" style={{ borderRadius: "4px" }} />
        <text x="24" y="145" fontFamily="'Courier New', monospace" fontSize="13" fontWeight="600" fill="white" letterSpacing="2">{displayNumber}</text>
        <text x="24" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill={accentDim} letterSpacing="2">CARD HOLDER</text>
        <text x="24" y="192" fontFamily="Poppins, sans-serif" fontSize="12" fontWeight="600" fill="white" letterSpacing="1">{holderName.toUpperCase().slice(0, 22)}</text>
        <text x="298" y="174" fontFamily="Poppins, sans-serif" fontSize="9" fill={accentDim} letterSpacing="2">EXPIRES</text>
        <text x="298" y="192" fontFamily="Poppins, sans-serif" fontSize="12" fontWeight="600" fill="white">{expiry ?? "••/••"}</text>
        <line x1="12" y1="208" x2="368" y2="208" stroke={accent} strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="12" y="213" width="108" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
        <text x="66" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">BALANCE</text>
        <text x="66" y="246" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="15" fontWeight="700" fill="white">{balanceDisplay}</text>
        <g onClick={() => setShowCvv((v) => !v)} style={{ cursor: "pointer" }}>
          <rect x="128" y="213" width="108" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
          <text x="182" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">CVV</text>
          <text x="182" y="246" textAnchor="middle" fontFamily="'Courier New', monospace" fontSize="15" fontWeight="700" fill="white">{cvvDisplay}</text>
        </g>
        <g onClick={() => setShowNumber((v) => !v)} style={{ cursor: "pointer" }}>
          <rect x="244" y="213" width="124" height="46" rx="8" fill="rgba(0,229,255,0.06)" stroke={accent} strokeWidth="0.5" strokeOpacity="0.2" />
          <text x="306" y="225" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fill={accentDim} letterSpacing="1">FULL PAN</text>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", padding: "16px" }} onClick={onClose}>
      <div style={{ background: "#0d1428", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, marginBottom: "20px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Btn({ onClick, disabled, children, variant = "primary" }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "danger-outline";
}) {
  const styles = {
    primary: { background: "#00e5ff", color: "#1a1a2e", border: "none" },
    secondary: { background: "rgba(0,229,255,0.1)", color: "#fff", border: "1px solid rgba(0,229,255,0.3)" },
    danger: { background: "#ff4444", color: "#fff", border: "none" },
    "danger-outline": { background: "transparent", color: "#ff6666", border: "1px solid rgba(255,68,68,0.5)" },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles, borderRadius: "12px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, width: "100%", fontFamily: "Poppins, sans-serif" }}>
      {children}
    </button>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value?: string | null; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    }
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,229,255,0.07)" }}>
      <span style={{ color: "#6677aa", fontSize: "12px", minWidth: "110px" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "flex-end" }}>
        <span style={{ color: "#dde", fontSize: "12px", fontWeight: 600, textAlign: "right", wordBreak: "break-all", maxWidth: "180px" }}>
          {value || "—"}
        </span>
        {copyable && value && (
          <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: copied ? "#00e5ff" : "#556677" }}>
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const isActive = status === "active";
  const color = isActive ? "#00e5ff" : "#ff8888";
  const bg = isActive ? "rgba(0,229,255,0.1)" : "rgba(255,68,68,0.12)";
  const border = isActive ? "rgba(0,229,255,0.3)" : "rgba(255,68,68,0.35)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", background: bg, border: `1px solid ${border}`, color, fontSize: "12px", fontWeight: 600 }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </span>
  );
}

function DangerZone({ card, onTerminate }: { card: any; onTerminate: () => void }) {
  return (
    <div style={{ width: "100%", maxWidth: "380px", marginTop: "28px" }}>
      <div style={{ borderTop: "1px solid rgba(255,68,68,0.2)", paddingTop: "20px" }}>
        <p style={{ color: "#886677", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, marginBottom: "12px" }}>⚠️ Danger Zone</p>
        <button
          onClick={onTerminate}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid rgba(255,68,68,0.4)", borderRadius: "10px", padding: "10px 16px", color: "#ff6666", fontFamily: "Poppins, sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%" }}
        >
          <Trash2 size={15} />
          Terminate Card
        </button>
      </div>
    </div>
  );
}

type ActiveTab = "overview" | "details" | "billing" | "history";

export default function CardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"fund" | "freeze" | "confirm-create" | "terminate" | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [amount, setAmount] = useState("");
  const [freezePassword, setFreezePassword] = useState("");
  const [freezeError, setFreezeError] = useState("");
  const [terminatePassword, setTerminatePassword] = useState("");
  const [terminateError, setTerminateError] = useState("");
  const [country, setCountry] = useState("ETH");
  const [line1, setLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Edit billing address state
  const [showEditBilling, setShowEditBilling] = useState(false);
  const [editLine1, setEditLine1] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editPostal, setEditPostal] = useState("");
  const [editCountry, setEditCountry] = useState("ETH");
  const [editPhone, setEditPhone] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const { data: feesData } = useQuery({ queryKey: ["card-fees"], queryFn: () => apiFetch("/api/cards/fees") });
  const { data: meData } = useQuery({ queryKey: ["me-card"], queryFn: () => apiFetch("/api/auth/me") });

  // Pre-fill phone from user profile when data loads
  useEffect(() => {
    const p = (meData as any)?.phone ?? "";
    if (p && !phone) setPhone(p);
  }, [meData]);
  const { data: cardData, refetch: refetchCard, isFetching: cardFetching, isLoading: cardLoading } = useQuery({
    queryKey: ["my-card"],
    queryFn: () => apiFetch("/api/cards/my-card"),
    refetchInterval: (query) => {
      const c = (query.state.data as any)?.card;
      return c?.cardStatus === "processing" ? 30000 : false;
    },
  });
  const { data: walletData, isLoading: walletLoading } = useQuery({ queryKey: ["wallet-card"], queryFn: () => apiFetch("/api/wallet") });
  const { data: historyData } = useQuery({
    queryKey: ["card-history"],
    queryFn: () => apiFetch("/api/cards/history"),
    enabled: activeTab === "history",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-card"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-card"] });
  };

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/cards/create", { method: "POST", body: JSON.stringify({ country, line1, city: addrCity, state: addrState || addrCity, postal_code: postalCode, phone }) }),
    onSuccess: (d: any) => {
      invalidate();
      setModal(null);
      if (d?.queued) {
        showToast("⏳ Request queued! You'll be notified when your card is ready. No extra charges.");
      } else {
        showToast("Card created! It will be ready in a few minutes.");
      }
    },
    onError: (e: any) => { setModal(null); showToast(e.message, false); },
  });
  const fundMutation = useMutation({
    mutationFn: (amt: number) => apiFetch("/api/cards/fund", { method: "POST", body: JSON.stringify({ amount: amt }) }),
    onSuccess: (d: any) => {
      invalidate();
      setModal(null);
      setAmount("");
      if (d?.queued) {
        showToast("⏳ Top-up queued! Your balance is reserved and will be credited to your card shortly.");
        return;
      }
      const cardBal = d?.newCardBalance ? `$${parseFloat(d.newCardBalance).toFixed(2)}` : "";
      const walBal = d?.newPlatformBalance ? `$${parseFloat(d.newPlatformBalance).toFixed(2)}` : "";
      showToast(`✅ Card topped up! Card balance: ${cardBal} | Wallet: ${walBal}`);
    },
    onError: (e: any) => showToast(e.message, false),
  });
  const freezeMutation = useMutation({
    mutationFn: (pwd: string) => apiFetch("/api/cards/freeze", { method: "POST", body: JSON.stringify({ password: pwd }) }),
    onSuccess: (d: any) => { invalidate(); setModal(null); setFreezePassword(""); setFreezeError(""); showToast(d.message); },
    onError: (e: any) => { setFreezeError(e.message); },
  });
  const terminateMutation = useMutation({
    mutationFn: (pwd: string) => apiFetch("/api/cards/terminate", { method: "POST", body: JSON.stringify({ password: pwd }) }),
    onSuccess: (d: any) => {
      invalidate();
      setModal(null);
      setTerminatePassword("");
      setTerminateError("");
      showToast(d.message);
      setActiveTab("overview");
    },
    onError: (e: any) => { setTerminateError(e.message); },
  });

  const updateBillingMutation = useMutation({
    mutationFn: () => apiFetch("/api/cards/billing", { method: "PATCH", body: JSON.stringify({ line1: editLine1, city: editCity, state: editState || editCity, postal_code: editPostal, country: editCountry, phone: editPhone }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-card"] });
      setShowEditBilling(false);
      showToast("✅ Billing address updated successfully!");
    },
    onError: (e: any) => showToast(e.message, false),
  });

  const fees = (feesData as any) ?? { cardCreationFee: "2.00", cardInitialLoad: "3.00", cardMinFund: "2.00", totalRequired: "5.00" };
  const creationFee = parseFloat(fees.cardCreationFee);
  const initialLoad = parseFloat(fees.cardInitialLoad);
  const totalRequired = parseFloat(fees.totalRequired ?? fees.cardCreationFee) + parseFloat(fees.cardInitialLoad ?? "0");
  const minFund = parseFloat(fees.cardMinFund);

  const kycStatus = meData?.kycStatus;
  const card = (cardData as any)?.card ?? null;
  const walletBalance = parseFloat((walletData as any)?.availableBalance ?? "0");
  const kycName = (meData as any)?.kycFullName ?? (meData as any)?.username ?? "YOUR NAME";
  const isFrozen = card?.cardStatus === "inactive" || card?.cardStatus === "frozen";
  const isProcessing = card?.cardStatus === "processing";
  const isActive = card && !isFrozen && !isProcessing;
  const mutBusy = createMutation.isPending || fundMutation.isPending || freezeMutation.isPending || terminateMutation.isPending;

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
    { id: "billing", label: "Billing" },
    { id: "history", label: "History" },
  ];

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
                ["💳", "Card creation fee", `$${creationFee.toFixed(2)} USDT`],
                ["💰", "Initial funding loaded", `$${initialLoad.toFixed(2)} USDT automatically`],
                ["📋", "Total required", `$${totalRequired.toFixed(2)} USDT minimum balance`],
              ].map(([icon, label, value]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.15)", borderRadius: "10px" }}>
                  <span style={{ color: "#8899aa", fontSize: "13px" }}>{icon} {label}</span>
                  <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            {walletBalance < totalRequired && (
              <p style={{ color: "#ff8888", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                You need ${totalRequired.toFixed(2)} USDT — you have ${walletBalance.toFixed(2)}. Please deposit first.
              </p>
            )}
            <div style={{ width: "100%", maxWidth: "360px" }}>
              <Btn onClick={() => setModal("confirm-create")} disabled={walletBalance < totalRequired}>Create My Card</Btn>
            </div>
          </>
        )}

        {/* Loading skeleton */}
        {kycStatus === "verified" && cardLoading && (
          <div style={{ width: "100%", maxWidth: "380px", height: "220px", background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: "18px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={22} color="#00e5ff" style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
          </div>
        )}

        {/* STATE 3 — Processing */}
        {kycStatus === "verified" && card && isProcessing && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "24px" }}>
              <CardVisual holderName={card.nameOnCard ?? kycName} last4={card.last4} expiry={card.expiry} balance={card.balance} status={card.cardStatus} />
            </div>
            <div style={{ width: "100%", maxWidth: "360px", background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)", borderRadius: "16px", padding: "24px", textAlign: "center" }}>
              <Clock size={28} color="#ffaa00" style={{ margin: "0 auto 10px" }} />
              <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>Card Being Set Up</h3>
              <p style={{ color: "#8899aa", fontSize: "13px", lineHeight: 1.5, marginBottom: "16px" }}>Your card is being set up. This usually takes a few minutes.</p>
              <button onClick={() => refetchCard()} disabled={cardFetching} style={{ background: "rgba(255,170,0,0.15)", border: "1px solid rgba(255,170,0,0.4)", borderRadius: "10px", padding: "10px 20px", color: "#ffaa00", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <RefreshCw size={14} style={{ animation: cardFetching ? "spin 1s linear infinite" : "none" }} /> Refresh Status
              </button>
            </div>
          </>
        )}

        {/* STATES 4 & 5 — Active / Frozen — TABBED UI */}
        {kycStatus === "verified" && card && (isActive || isFrozen) && (
          <>
            <div style={{ width: "100%", maxWidth: "380px", marginBottom: "16px" }}>
              <CardVisual
                holderName={card.nameOnCard ?? kycName}
                cardNumber={card.cardNumber}
                last4={card.last4}
                cvv={card.cvv}
                expiry={card.expiry}
                balance={card.balance}
                status={card.cardStatus}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "20px", background: isFrozen ? "rgba(255,68,68,0.15)" : "rgba(0,229,255,0.1)", border: `1px solid ${isFrozen ? "rgba(255,68,68,0.4)" : "rgba(0,229,255,0.3)"}`, color: isFrozen ? "#ff8888" : "#00e5ff", fontSize: "13px", fontWeight: 600 }}>
                {isFrozen ? <Lock size={13} /> : <CheckCircle size={13} />}
                {isFrozen ? "Frozen" : "Active"}
              </span>
            </div>

            {/* Tabs */}
            <div style={{ width: "100%", maxWidth: "380px", display: "flex", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "12px", padding: "4px", marginBottom: "20px", gap: "2px" }}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: "8px", border: "none", fontFamily: "Poppins, sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: activeTab === id ? "rgba(0,229,255,0.15)" : "transparent",
                    color: activeTab === id ? "#00e5ff" : "#6677aa",
                    borderBottom: activeTab === id ? "2px solid #00e5ff" : "2px solid transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* TAB: Overview */}
            {activeTab === "overview" && (
              <div style={{ width: "100%", maxWidth: "380px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                  {[
                    { icon: <ArrowUpCircle size={20} color={isFrozen ? "#556677" : "#00e5ff"} />, label: "Top-Up", disabled: isFrozen, onClick: () => { setAmount(""); setModal("fund"); } },
                    { icon: <RefreshCw size={20} color={cardFetching ? "#556677" : "#00e5ff"} style={{ animation: cardFetching ? "spin 1s linear infinite" : "none" }} />, label: "Refresh", disabled: cardFetching, onClick: () => refetchCard() },
                    { icon: isFrozen ? <Unlock size={20} color="#00e5ff" /> : <Lock size={20} color="#ff6666" />, label: isFrozen ? "Activate" : "Freeze", disabled: false, onClick: () => setModal("freeze") },
                    { icon: <History size={20} color="#00e5ff" />, label: "History", disabled: false, onClick: () => setActiveTab("history") },
                  ].map(({ icon, label, disabled, onClick }) => (
                    <button key={label} onClick={onClick} disabled={disabled} style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "14px", padding: "16px 10px", color: disabled ? "#556677" : "#fff", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "Poppins, sans-serif", opacity: disabled ? 0.5 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      {icon}
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{label}</span>
                    </button>
                  ))}
                </div>
                <DangerZone card={card} onTerminate={() => setModal("terminate")} />
              </div>
            )}

            {/* TAB: Details */}
            {activeTab === "details" && (
              <div style={{ width: "100%", maxWidth: "380px" }}>
                <div style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "14px", padding: "16px 20px" }}>
                  <p style={{ color: "#00e5ff", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>📋 CARD DETAILS</p>
                  <InfoRow label="Card Holder" value={card.nameOnCard} />
                  <InfoRow label="Card Type" value={card.cardType ?? "Virtual Visa"} />
                  <InfoRow label="Card Brand" value={card.cardBrand ?? "Visa"} />
                  <InfoRow
                    label="Card ID"
                    value={card.cardId ? `${card.cardId.slice(0, 8)}…` : null}
                    copyable
                  />
                  <InfoRow label="Reference" value={card.reference} copyable />
                  <InfoRow
                    label="Created Date"
                    value={card.cardCreatedDate
                      ? new Date(card.cardCreatedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                      : card.createdAt
                        ? new Date(card.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : null}
                  />
                  <InfoRow label="Customer Email" value={card.customerEmail} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                    <span style={{ color: "#6677aa", fontSize: "12px" }}>Card Status</span>
                    <StatusBadge status={card.cardStatus} />
                  </div>
                </div>
                <DangerZone card={card} onTerminate={() => setModal("terminate")} />
              </div>
            )}

            {/* TAB: Billing */}
            {activeTab === "billing" && (
              <div style={{ width: "100%", maxWidth: "380px" }}>
                <div style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "14px", padding: "16px 20px", marginBottom: "12px" }}>
                  <p style={{ color: "#00e5ff", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>🏠 BILLING ADDRESS</p>
                  <InfoRow label="Name" value={card.billing?.name ?? card.nameOnCard} />
                  <InfoRow label="Address" value={card.billing?.line1 ?? card.billingLine1 ?? "N/A"} />
                  <InfoRow label="City" value={card.billing?.city ?? card.billingCity ?? "N/A"} />
                  <InfoRow label="State" value={card.billing?.state ?? card.billingState ?? "N/A"} />
                  <InfoRow label="Postal Code" value={card.billing?.postalCode ?? card.billingPostal ?? "00000"} />
                  <InfoRow label="Country" value={(() => {
                    const c = card.billing?.country ?? card.billingCountry ?? "ETH";
                    const map: Record<string, string> = { ETH: "Ethiopia (ETH)", NGA: "Nigeria (NGA)", GHA: "Ghana (GHA)", KEN: "Kenya (KEN)", TZA: "Tanzania (TZA)", UGA: "Uganda (UGA)", ZAF: "South Africa (ZAF)", EGY: "Egypt (EGY)", USA: "United States (USA)", GBR: "United Kingdom (GBR)", CAN: "Canada (CAN)", DEU: "Germany (DEU)", FRA: "France (FRA)", IND: "India (IND)" };
                    return map[c] ?? c;
                  })()} />
                  {(card.billing?.phone || (meData as any)?.phone) && (
                    <InfoRow label="Phone" value={card.billing?.phone || (meData as any)?.phone} />
                  )}
                </div>
                <div style={{ background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
                  <p style={{ color: "#ffaa66", fontSize: "12px", lineHeight: 1.6, margin: 0 }}>
                    💡 Use this billing address and phone when making online purchases. If StroWallet shows a different address, tap Edit to sync them.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditLine1(card.billing?.line1 ?? card.billingLine1 ?? "");
                    setEditCity(card.billing?.city ?? card.billingCity ?? "");
                    setEditState(card.billing?.state ?? card.billingState ?? "");
                    setEditPostal(card.billing?.postalCode ?? card.billingPostal ?? "");
                    setEditCountry(card.billing?.country ?? card.billingCountry ?? "ETH");
                    setEditPhone(card.billing?.phone ?? (meData as any)?.phone ?? "");
                    setShowEditBilling(true);
                  }}
                  style={{ width: "100%", background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: "12px", padding: "12px", color: "#00e5ff", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "14px", cursor: "pointer", marginBottom: "16px" }}
                >
                  ✏️ Edit Billing Address
                </button>
                <DangerZone card={card} onTerminate={() => setModal("terminate")} />
              </div>
            )}

            {/* TAB: History */}
            {activeTab === "history" && (
              <div style={{ width: "100%", maxWidth: "380px" }}>
                <h3 style={{ color: "#fff", fontSize: "15px", fontWeight: 700, marginBottom: "12px" }}>Transaction History</h3>
                {!historyData ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                    <RefreshCw size={20} color="#00e5ff" style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
                  </div>
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
                <DangerZone card={card} onTerminate={() => setModal("terminate")} />
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}

      {modal === "confirm-create" && (
        <Modal title="Create Your Xendrx Card" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {[["Card for", kycName], ["Creation fee", `$${creationFee.toFixed(2)} USDT deducted`], ["Auto-loaded", `$${initialLoad.toFixed(2)} USDT on card`], ["Your balance", `$${walletBalance.toFixed(2)} USDT`]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,229,255,0.05)", borderRadius: "10px" }}>
                <span style={{ color: "#8899aa", fontSize: "13px" }}>{l}</span>
                <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ color: "#8899aa", fontSize: "12px", display: "block", marginBottom: "6px" }}>🌍 Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%", padding: "11px 14px", background: "#0d1428", border: "1px solid rgba(0,229,255,0.25)", borderRadius: "10px", color: "#fff", fontSize: "14px", fontFamily: "Poppins, sans-serif", outline: "none", cursor: "pointer" }}>
              {[["ETH","🇪🇹 Ethiopia"],["NGA","🇳🇬 Nigeria"],["GHA","🇬🇭 Ghana"],["KEN","🇰🇪 Kenya"],["TZA","🇹🇿 Tanzania"],["UGA","🇺🇬 Uganda"],["ZAF","🇿🇦 South Africa"],["EGY","🇪🇬 Egypt"],["MAR","🇲🇦 Morocco"],["USA","🇺🇸 United States"],["GBR","🇬🇧 United Kingdom"],["CAN","🇨🇦 Canada"],["DEU","🇩🇪 Germany"],["FRA","🇫🇷 France"],["IND","🇮🇳 India"]].map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ color: "#00e5ff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "10px" }}>📍 BILLING ADDRESS</p>
            <p style={{ color: "#8899aa", fontSize: "11px", marginBottom: "12px", lineHeight: 1.5 }}>Used for online purchases — enter a real, valid address.</p>
            {[
              { label: "Street Address *", val: line1, set: setLine1, ph: "e.g. Bole Road, Addis Ababa" },
              { label: "City *", val: addrCity, set: setAddrCity, ph: "e.g. Addis Ababa" },
              { label: "State / Region", val: addrState, set: setAddrState, ph: "e.g. Addis Ababa" },
              { label: "Postal Code *", val: postalCode, set: setPostalCode, ph: "e.g. 1000" },
              { label: "Phone Number *", val: phone, set: setPhone, ph: "e.g. +251974408281" },
            ].map(({ label, val, set, ph }) => (
              <div key={label} style={{ marginBottom: "8px" }}>
                <label style={{ color: "#8899aa", fontSize: "11px", display: "block", marginBottom: "4px" }}>{label}</label>
                <input
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ph}
                  style={{ width: "100%", padding: "10px 12px", background: "#0d1428", border: `1px solid ${val ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", color: "#fff", fontSize: "13px", fontFamily: "Poppins, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={() => createMutation.mutate()} disabled={mutBusy || !line1.trim() || !addrCity.trim() || !postalCode.trim() || !phone.trim()}>{createMutation.isPending ? "Creating…" : "Confirm"}</Btn>
          </div>
        </Modal>
      )}

      {modal === "fund" && (
        <Modal title="Top-Up Card" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,229,255,0.05)", borderRadius: "10px" }}>
              <span style={{ color: "#8899aa", fontSize: "13px" }}>Available</span>
              <span style={{ color: "#00e5ff", fontSize: "13px", fontWeight: 700 }}>${walletBalance.toFixed(2)} USDT</span>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,229,255,0.04)", borderRadius: "10px", border: "1px solid rgba(0,229,255,0.15)" }}>
                <span style={{ color: "#8899aa", fontSize: "13px" }}>Card balance after</span>
                <span style={{ color: "#fff", fontSize: "13px", fontWeight: 700 }}>${(parseFloat(card?.balance ?? "0") + parseFloat(amount)).toFixed(2)}</span>
              </div>
            )}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount (minimum $${minFund.toFixed(2)})`} min={minFund} style={{ width: "100%", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "12px", color: "#fff", fontSize: "15px", marginBottom: "6px", boxSizing: "border-box", fontFamily: "Poppins, sans-serif", outline: "none" }} />
          <p style={{ color: "#8899aa", fontSize: "11px", marginBottom: "10px" }}>Minimum: ${minFund.toFixed(2)}</p>
          {amount && parseFloat(amount) > 0 && parseFloat(amount) < minFund && <p style={{ color: "#ff8888", fontSize: "12px", marginBottom: "10px" }}>Minimum top-up amount is ${minFund.toFixed(2)}</p>}
          {!walletLoading && amount && parseFloat(amount) > walletBalance && <p style={{ color: "#ff8888", fontSize: "12px", marginBottom: "10px" }}>Insufficient wallet balance — you have ${walletBalance.toFixed(2)} USDT</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={() => fundMutation.mutate(parseFloat(amount))} disabled={mutBusy || walletLoading || !amount || parseFloat(amount) < minFund || (!walletLoading && parseFloat(amount) > walletBalance)}>
              {fundMutation.isPending ? "Processing…" : "Top-Up"}
            </Btn>
          </div>
        </Modal>
      )}

      {modal === "freeze" && (
        <Modal title={isFrozen ? "🔓 Activate Card" : "🔒 Freeze Card"} onClose={() => { setModal(null); setFreezePassword(""); setFreezeError(""); }}>
          <p style={{ color: "#8899aa", fontSize: "13px", marginBottom: "16px", lineHeight: 1.6 }}>
            {isFrozen ? "Please enter your platform password to reactivate this card." : "For your security, please enter your platform password to freeze this card."}
          </p>
          <input type="password" value={freezePassword} onChange={(e) => { setFreezePassword(e.target.value); setFreezeError(""); }} placeholder="Enter your password" autoFocus
            style={{ width: "100%", padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: `1px solid ${freezeError ? "rgba(255,68,68,0.5)" : "rgba(0,229,255,0.2)"}`, borderRadius: "12px", color: "#fff", fontSize: "15px", marginBottom: freezeError ? "8px" : "16px", boxSizing: "border-box", fontFamily: "Poppins, sans-serif", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && freezePassword && !mutBusy) freezeMutation.mutate(freezePassword); }}
          />
          {freezeError && <p style={{ color: "#ff8888", fontSize: "12px", marginBottom: "12px" }}>{freezeError}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => { setModal(null); setFreezePassword(""); setFreezeError(""); }}>Cancel</Btn>
            <Btn variant={isFrozen ? "primary" : "danger"} onClick={() => freezeMutation.mutate(freezePassword)} disabled={mutBusy || !freezePassword}>
              {freezeMutation.isPending ? "Verifying…" : isFrozen ? "Confirm Activate" : "Confirm Freeze"}
            </Btn>
          </div>
        </Modal>
      )}

      {modal === "terminate" && (
        <Modal title="⚠️ Terminate Card" onClose={() => { setModal(null); setTerminatePassword(""); setTerminateError(""); }}>
          <div style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertTriangle size={16} color="#ff8888" style={{ marginTop: "1px", flexShrink: 0 }} />
              <div>
                <p style={{ color: "#ff8888", fontSize: "12px", fontWeight: 700, margin: "0 0 6px" }}>This action is PERMANENT and cannot be undone.</p>
                <ul style={{ color: "#cc8888", fontSize: "12px", lineHeight: 1.7, margin: 0, paddingLeft: "14px" }}>
                  <li>Your card will be permanently deactivated</li>
                  {parseFloat(card?.balance ?? "0") > 0 && (
                    <li>Remaining balance <strong style={{ color: "#ffaa88" }}>${parseFloat(card.balance).toFixed(2)}</strong> will be returned to your wallet</li>
                  )}
                  <li>You will need to create a new card to use card services again</li>
                </ul>
              </div>
            </div>
          </div>
          <label style={{ color: "#8899aa", fontSize: "12px", display: "block", marginBottom: "6px" }}>Enter your platform password to confirm:</label>
          <input type="password" value={terminatePassword} onChange={(e) => { setTerminatePassword(e.target.value); setTerminateError(""); }} placeholder="Enter your password" autoFocus
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,68,68,0.05)", border: `1px solid ${terminateError ? "rgba(255,68,68,0.7)" : "rgba(255,68,68,0.3)"}`, borderRadius: "12px", color: "#fff", fontSize: "15px", marginBottom: terminateError ? "8px" : "16px", boxSizing: "border-box", fontFamily: "Poppins, sans-serif", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && terminatePassword && !mutBusy) terminateMutation.mutate(terminatePassword); }}
          />
          {terminateError && <p style={{ color: "#ff8888", fontSize: "12px", marginBottom: "12px" }}>{terminateError}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="secondary" onClick={() => { setModal(null); setTerminatePassword(""); setTerminateError(""); }}>Cancel</Btn>
            <Btn variant="danger" onClick={() => terminateMutation.mutate(terminatePassword)} disabled={mutBusy || !terminatePassword}>
              {terminateMutation.isPending ? "Terminating…" : "Terminate Card"}
            </Btn>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
