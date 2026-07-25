import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Gamepad2, RefreshCw, TrendingUp, Info, ChevronDown, ChevronUp, Loader2, Trophy, X, Zap } from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KenoBetSettings {
  minBet: string;
  maxBet: string;
  minTopup: string;
  maxTopup: string;
  gameEnabled: boolean;
}

interface KenoWallet {
  realBalance: string;
  demoBalance: string;
  settings: KenoBetSettings;
}

interface KenoRound {
  id: number;
  mode: string;
  picks: number[];
  drawnNumbers: number[];
  betAmount: string;
  hitCount: number;
  multiplier: string;
  payoutAmount: string;
  createdAt: string;
}

interface PaytableEntry {
  picks: number;
  hits: number;
  multiplier: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_UP_PRESETS = [5, 20, 50, 100, 250, 500, 1000];

function getToken() {
  return localStorage.getItem("p2p_token") ?? "";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  return res;
}

// ─── RTP calculator (for paytable display) ───────────────────────────────────

function combination(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

function hypergeometricP(picks: number, hits: number): number {
  return (combination(20, hits) * combination(60, picks - hits)) / combination(80, picks);
}

function calcRtp(picks: number, paytable: PaytableEntry[]): number {
  const rows = paytable.filter(r => r.picks === picks);
  let rtp = 0;
  for (const r of rows) {
    rtp += hypergeometricP(picks, r.hits) * parseFloat(r.multiplier);
  }
  return rtp;
}

// ─── Mode selector ────────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (mode: "demo" | "real") => void }) {
  const [, setLocation] = useLocation();

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={() => setLocation("/wallet")}
        className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Back to wallet"
      >
        <ArrowLeft className="h-4 w-4" />
        Wallet
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-purple-600/20 border-2 border-purple-500/40 flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-10 h-10 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Keno</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick your numbers, beat the draw</p>
        </div>

        <div className="space-y-3">
          {/* Demo mode */}
          <button
            onClick={() => onSelect("demo")}
            className="w-full rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all p-5 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">Demo Mode</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 uppercase tracking-wide">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Play with virtual credits — no real money involved</p>
                <p className="text-xs text-purple-400 mt-1">10,000 demo credits to start</p>
              </div>
            </div>
          </button>

          {/* Real mode */}
          <button
            onClick={() => onSelect("real")}
            className="w-full rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all p-5 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">Real Mode</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wide">USDT</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Play with real USDT from your Keno wallet</p>
                <p className="text-xs text-amber-400 mt-1">Top up from your main wallet anytime</p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Games are for entertainment. Play responsibly.
        </p>
      </div>
    </div>
  );
}

// ─── Top-up / Withdraw modal ──────────────────────────────────────────────────

function TopUpModal({
  type,
  maxAmount,
  settings,
  onClose,
  onSuccess,
}: {
  type: "topup" | "withdraw";
  maxAmount: number;
  settings: KenoBetSettings;
  onClose: () => void;
  onSuccess: (newBalance: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const { toast } = useToast();

  const minAmount = type === "topup" ? parseFloat(settings.minTopup) : 0.01;
  const maxAmountAllowed = type === "topup" ? parseFloat(settings.maxTopup) : maxAmount;
  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount >= minAmount && parsedAmount <= maxAmountAllowed;

  async function handleConfirm(password: string) {
    setPwLoading(true);
    setPwError("");
    try {
      const res = await apiFetch(`/api/games/keno/${type}`, {
        method: "POST",
        body: JSON.stringify({ amount: parsedAmount.toFixed(2), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "Failed");
        setPwLoading(false);
        return;
      }
      toast({ description: type === "topup" ? "Keno wallet topped up!" : "Withdrawn to main wallet!" });
      onSuccess(data.kenoBalance);
      onClose();
    } catch {
      setPwError("Network error");
      setPwLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center sm:items-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{type === "topup" ? "Top Up Keno Wallet" : "Withdraw to Main Wallet"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {type === "topup" && (
          <div className="grid grid-cols-4 gap-2">
            {TOP_UP_PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  amount === String(p)
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground"
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Amount (USDT)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Min ${minAmount} · Max ${maxAmountAllowed}`}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
          {type === "withdraw" && (
            <p className="text-xs text-muted-foreground mt-1">Available: {maxAmount.toFixed(2)} USDT</p>
          )}
        </div>

        <button
          disabled={!isValid}
          onClick={() => setShowPw(true)}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      {showPw && (
        <PasswordConfirmModal
          title={type === "topup" ? "Confirm Top Up" : "Confirm Withdrawal"}
          description={`Enter your account password to ${type === "topup" ? "move $" + parsedAmount.toFixed(2) + " USDT to your Keno wallet" : "withdraw $" + parsedAmount.toFixed(2) + " USDT to your main wallet"}.`}
          confirmLabel={type === "topup" ? "Top Up" : "Withdraw"}
          loading={pwLoading}
          error={pwError}
          onConfirm={handleConfirm}
          onCancel={() => { setShowPw(false); setPwError(""); }}
        />
      )}
    </div>
  );
}

// ─── Paytable sheet ───────────────────────────────────────────────────────────

function PaytableSheet({ paytable, picksCount, onClose }: { paytable: PaytableEntry[]; picksCount: number; onClose: () => void }) {
  const rows = paytable.filter(r => r.picks === picksCount && parseFloat(r.multiplier) > 0);
  const rtp = calcRtp(picksCount, paytable);

  return (
    <div className="fixed inset-0 z-[9997] flex items-end justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Payouts — Pick {picksCount}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">RTP: <span className="text-purple-400 font-semibold">{(rtp * 100).toFixed(1)}%</span></span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No payouts for this pick count</p>}
          {rows.map(r => (
            <div key={r.hits} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground">{r.hits} of {r.picks} hits</span>
              <span className="font-bold text-purple-400">{parseFloat(r.multiplier).toFixed(2)}×</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({
  drawn,
  picks,
  hitCount,
  multiplier,
  payout,
  betAmount,
  onClose,
}: {
  drawn: number[];
  picks: number[];
  hitCount: number;
  multiplier: number;
  payout: number;
  betAmount: number;
  onClose: () => void;
}) {
  const won = payout > 0;
  return (
    <div className="fixed inset-0 z-[9996] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl border border-border p-6 text-center space-y-4">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${won ? "bg-purple-600/20" : "bg-muted/30"}`}>
          {won
            ? <Trophy className="w-8 h-8 text-purple-400" />
            : <X className="w-8 h-8 text-muted-foreground" />
          }
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{won ? "You won!" : "No win this round"}</p>
          {won && (
            <p className="text-3xl font-black text-purple-400">+{payout.toFixed(2)} <span className="text-lg">USDT</span></p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {hitCount} hit{hitCount !== 1 ? "s" : ""} · {multiplier}× multiplier
          </p>
        </div>

        {/* Mini grid showing draw result */}
        <div className="grid grid-cols-10 gap-1 max-w-[260px] mx-auto">
          {drawn.map(n => {
            const isHit = picks.includes(n);
            return (
              <div
                key={n}
                className={`aspect-square rounded text-[9px] font-bold flex items-center justify-center
                  ${isHit ? "bg-purple-600 text-white" : "bg-secondary text-muted-foreground"}`}
              >
                {n}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export default function KenoPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"demo" | "real" | null>(null);
  const [wallet, setWallet] = useState<KenoWallet | null>(null);
  const [paytable, setPaytable] = useState<PaytableEntry[]>([]);
  const [history, setHistory] = useState<KenoRound[]>([]);

  const [selectedNums, setSelectedNums] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState("1.00");
  const [playing, setPlaying] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [revealedNums, setRevealedNums] = useState<number[]>([]);

  const [result, setResult] = useState<{ drawn: number[]; picks: number[]; hitCount: number; multiplier: number; payout: number; betAmount: number } | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);

  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  // Load wallet + paytable
  async function loadWallet() {
    try {
      const res = await apiFetch("/api/games/keno/wallet");
      if (res.ok) setWallet(await res.json());
    } catch { /* ignore */ }
  }

  async function loadPaytable() {
    try {
      const res = await apiFetch("/api/games/keno/paytable");
      if (res.ok) setPaytable(await res.json());
    } catch { /* ignore */ }
  }

  async function loadHistory() {
    try {
      const res = await apiFetch(`/api/games/keno/history?mode=${mode}&limit=10`);
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (mode) {
      loadWallet();
      loadPaytable();
      loadHistory();
    }
  }, [mode]);

  function toggleNumber(n: number) {
    if (animating || playing) return;
    setSelectedNums(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= 10) {
        toast({ description: "Maximum 10 numbers", variant: "destructive" });
        return prev;
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  function clearSelections() {
    if (!animating && !playing) setSelectedNums([]);
  }

  const balance = mode === "real"
    ? parseFloat(wallet?.realBalance ?? "0")
    : parseFloat(wallet?.demoBalance ?? "10000");

  const bet = parseFloat(betAmount);
  const settings = wallet?.settings;
  const canPlay = (
    selectedNums.length >= 1 &&
    !isNaN(bet) && bet > 0 &&
    bet <= balance &&
    (!settings || (bet >= parseFloat(settings.minBet) && bet <= parseFloat(settings.maxBet))) &&
    !playing &&
    !animating &&
    (settings?.gameEnabled !== false)
  );

  async function handlePlay() {
    if (!canPlay || !mode) return;
    setPlaying(true);
    setRevealedNums([]);

    try {
      const res = await apiFetch("/api/games/keno/play", {
        method: "POST",
        body: JSON.stringify({ picks: selectedNums, betAmount: bet.toFixed(2), mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ description: data.error ?? "Play failed", variant: "destructive" });
        setPlaying(false);
        return;
      }

      // Animate the draw reveal
      setAnimating(true);
      setPlaying(false);
      const drawn: number[] = data.drawn;

      // Reveal numbers one by one
      for (let i = 0; i < drawn.length; i++) {
        await new Promise(r => setTimeout(r, 80));
        setRevealedNums(prev => [...prev, drawn[i]]);
      }

      await new Promise(r => setTimeout(r, 400));
      setAnimating(false);

      setResult({
        drawn,
        picks: selectedNums,
        hitCount: data.hitCount,
        multiplier: data.multiplier,
        payout: data.payout,
        betAmount: bet,
      });

      // Update balance
      if (mode === "real") {
        setWallet(prev => prev ? { ...prev, realBalance: String(data.newBalance) } : prev);
      } else {
        setWallet(prev => prev ? { ...prev, demoBalance: String(data.newBalance) } : prev);
      }

      await loadHistory();
    } catch {
      toast({ description: "Network error", variant: "destructive" });
      setPlaying(false);
      setAnimating(false);
    }
  }

  async function resetDemo() {
    setResettingDemo(true);
    try {
      const res = await apiFetch("/api/games/keno/demo/reset", { method: "POST" });
      if (res.ok) {
        setWallet(prev => prev ? { ...prev, demoBalance: "10000.00" } : prev);
        toast({ description: "Demo balance reset to 10,000" });
      }
    } finally {
      setResettingDemo(false);
    }
  }

  // ─── Mode selector screen ──────────────────────────────────────────────────
  if (!mode) return <ModeSelector onSelect={setMode} />;

  const rtp = selectedNums.length > 0 ? calcRtp(selectedNums.length, paytable) : null;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen pb-4">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMode(null); setSelectedNums([]); setRevealedNums([]); setResult(null); }}
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base">Keno</h1>
                {mode === "demo" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 uppercase tracking-wide">Demo</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Balance pill */}
            <div className="bg-secondary rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{mode === "demo" ? "Demo" : "USDT"}</span>
              <span className="font-bold text-sm text-foreground">
                {balance.toFixed(2)}
              </span>
            </div>

            {mode === "real" && (
              <button
                onClick={() => setShowTopUp(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
              >
                Top Up
              </button>
            )}
            {mode === "demo" && balance < 1 && (
              <button
                onClick={resetDemo}
                disabled={resettingDemo}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
              >
                {resettingDemo ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reset"}
              </button>
            )}
          </div>
        </div>

        {/* Wallet bar (Real mode — withdraw) */}
        {mode === "real" && (
          <div className="mx-4 mb-3 rounded-xl bg-secondary/60 border border-border px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Keno wallet: <span className="text-foreground font-semibold">{parseFloat(wallet?.realBalance ?? "0").toFixed(2)} USDT</span></span>
            <button
              onClick={() => setShowWithdraw(true)}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
            >
              Withdraw →
            </button>
          </div>
        )}

        {/* Number grid */}
        <div className="px-4 mb-3">
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
              const isSelected = selectedNums.includes(n);
              const isDrawn = revealedNums.includes(n);
              const isHit = isSelected && isDrawn;

              return (
                <button
                  key={n}
                  onClick={() => toggleNumber(n)}
                  className={`aspect-square rounded-lg text-[11px] font-bold flex items-center justify-center transition-all select-none
                    ${isHit
                      ? "bg-purple-600 text-white scale-105 shadow-lg shadow-purple-500/30"
                      : isSelected
                        ? "bg-purple-500/30 border-2 border-purple-500 text-purple-300"
                        : isDrawn
                          ? "bg-muted text-muted-foreground/50"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    }
                    ${animating ? "cursor-not-allowed" : ""}
                  `}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Selection info */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {selectedNums.length === 0
                ? "Tap numbers to pick (1–10)"
                : `${selectedNums.length} selected`}
              {rtp !== null && (
                <span className="ml-2 text-purple-400">· RTP {(rtp * 100).toFixed(0)}%</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {selectedNums.length > 0 && (
                <button
                  onClick={() => setShowPaytable(true)}
                  className="text-xs text-muted-foreground hover:text-purple-400 flex items-center gap-1"
                >
                  <Info className="w-3 h-3" /> Payouts
                </button>
              )}
              {selectedNums.length > 0 && (
                <button onClick={clearSelections} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* Bet amount + play */}
        <div className="px-4 space-y-3">
          {/* Quick bet amounts */}
          <div className="grid grid-cols-5 gap-1.5">
            {["0.10", "0.50", "1.00", "5.00", "10.00"].map(v => (
              <button
                key={v}
                onClick={() => setBetAmount(v)}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  betAmount === v
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "border-border text-muted-foreground hover:border-purple-500/50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                min={settings?.minBet ?? "0.10"}
                max={settings?.maxBet ?? "100"}
                step="0.10"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Bet amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USDT</span>
            </div>

            <button
              onClick={handlePlay}
              disabled={!canPlay}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {playing || animating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {animating ? "Drawing..." : "..."}</>
                : <><Zap className="w-4 h-4" /> Play</>
              }
            </button>
          </div>

          {settings && (
            <p className="text-[10px] text-muted-foreground text-center">
              Bet {settings.minBet}–{settings.maxBet} USDT · Pick 1–10 numbers
            </p>
          )}
        </div>

        {/* History */}
        <div className="px-4 mt-4">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full py-2"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Recent rounds
            {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>

          {showHistory && (
            <div className="space-y-2 mt-1">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No rounds yet</p>
              )}
              {history.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold">
                      {r.hitCount}/{r.picks.length} hits · {parseFloat(r.multiplier).toFixed(2)}×
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Bet {parseFloat(r.betAmount).toFixed(2)} · {new Date(r.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className={`text-right ${parseFloat(r.payoutAmount) > 0 ? "text-purple-400" : "text-muted-foreground"}`}>
                    <p className="text-sm font-bold">
                      {parseFloat(r.payoutAmount) > 0 ? `+${parseFloat(r.payoutAmount).toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      {result && (
        <ResultOverlay
          {...result}
          onClose={() => { setResult(null); setRevealedNums([]); setSelectedNums([]); }}
        />
      )}

      {showTopUp && wallet && (
        <TopUpModal
          type="topup"
          maxAmount={parseFloat(wallet.realBalance)}
          settings={wallet.settings}
          onClose={() => setShowTopUp(false)}
          onSuccess={(bal) => {
            setWallet(prev => prev ? { ...prev, realBalance: bal } : prev);
            setShowTopUp(false);
          }}
        />
      )}

      {showWithdraw && wallet && (
        <TopUpModal
          type="withdraw"
          maxAmount={parseFloat(wallet.realBalance)}
          settings={wallet.settings}
          onClose={() => setShowWithdraw(false)}
          onSuccess={(bal) => {
            setWallet(prev => prev ? { ...prev, realBalance: bal } : prev);
            setShowWithdraw(false);
            loadWallet();
          }}
        />
      )}

      {showPaytable && selectedNums.length > 0 && (
        <PaytableSheet
          paytable={paytable}
          picksCount={selectedNums.length}
          onClose={() => setShowPaytable(false)}
        />
      )}
    </AppLayout>
  );
}
