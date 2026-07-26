import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getGetWalletQueryKey, useGetWallet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, RefreshCw, TrendingUp, Info, ChevronDown, ChevronUp, Loader2, Trophy, X, Zap, Menu, CircleHelp, Minus, Plus, BarChart3, Crown, Check } from "lucide-react";
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
  const [selected, setSelected] = useState<"demo" | "real">("demo");

  return (
    <div className="relative min-h-screen bg-[#0e1117] flex flex-col items-center justify-center px-4 py-8">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setLocation("/wallet")}
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        aria-label="Back to wallet"
      >
        <ArrowLeft className="h-4 w-4" />
        Wallet
      </button>

      <div className="w-full max-w-[360px] flex flex-col items-center gap-6">
        {/* Hero image */}
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/40 border border-white/10">
          <img
            src="/src/assets/keno-balls.jpg"
            alt="Keno"
            className="w-full object-cover"
            style={{ maxHeight: 220 }}
          />
        </div>

        {/* DEMO / REAL toggle */}
        <div className="flex items-center gap-4">
          <span className={`text-sm font-bold tracking-wide transition-colors ${selected === "demo" ? "text-white" : "text-slate-500"}`}>
            DEMO
          </span>
          <button
            type="button"
            aria-label="Toggle mode"
            onClick={() => setSelected(s => s === "demo" ? "real" : "demo")}
            className="relative h-7 w-14 rounded-full border border-white/20 bg-white/10 transition-colors focus:outline-none"
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full shadow transition-all duration-300 ${
                selected === "real"
                  ? "left-[calc(100%-26px)] bg-amber-400"
                  : "left-0.5 bg-purple-400"
              }`}
            />
          </button>
          <span className={`text-sm font-bold tracking-wide transition-colors ${selected === "real" ? "text-white" : "text-slate-500"}`}>
            REAL
          </span>
        </div>

        {/* Mode description */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center min-h-[72px] flex flex-col items-center justify-center gap-1">
          {selected === "demo" ? (
            <>
              <p className="text-sm text-slate-200 font-medium">Play with virtual credits — no real money involved</p>
              <p className="text-xs text-purple-400 font-semibold">10,000 demo credits to start</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-200 font-medium">Play with real USDT from your Keno wallet</p>
              <p className="text-xs text-amber-400 font-semibold">Top up from your main wallet anytime</p>
            </>
          )}
        </div>

        {/* Play button */}
        <button
          type="button"
          onClick={() => onSelect(selected)}
          className={`w-full rounded-2xl py-4 text-base font-extrabold uppercase tracking-widest shadow-lg transition-all ${
            selected === "demo"
              ? "bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/30"
              : "bg-amber-400 hover:bg-amber-300 text-[#1a1000] shadow-amber-400/30"
          }`}
        >
          {selected === "demo" ? "Demo Play" : "Real Play"}
        </button>

        <p className="text-center text-[11px] text-slate-600">
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
  const maxAmountAllowed = type === "topup"
    ? Math.min(parseFloat(settings.maxTopup), maxAmount)
    : maxAmount;
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
            <p className="text-xs text-muted-foreground mt-1">Keno balance: {maxAmount.toFixed(2)} USDT</p>
          )}
          {type === "topup" && (
            <p className="text-xs text-muted-foreground mt-1">
              Available in main wallet: {maxAmount.toFixed(2)} USDT
            </p>
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
  const { data: mainWallet } = useGetWallet();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"demo" | "real" | null>(null);
  const [wallet, setWallet] = useState<KenoWallet | null>(null);
  const [paytable, setPaytable] = useState<PaytableEntry[]>([]);
  const [history, setHistory] = useState<KenoRound[]>([]);

  const [selectedNums, setSelectedNums] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState("1.00");
  const [animating, setAnimating] = useState(false);
  const [revealedNums, setRevealedNums] = useState<number[]>([]);
  const [activeDrawNumber, setActiveDrawNumber] = useState<number | null>(null);
  const [drawProgress, setDrawProgress] = useState(0);

  const [result, setResult] = useState<{ drawn: number[]; picks: number[]; hitCount: number; multiplier: number; payout: number; betAmount: number } | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);

  // ── Multiplayer round state ───────────────────────────────────────────────
  const [roundState, setRoundState] = useState<{
    roundId: number;
    phase: "betting" | "drawing";
    secondsLeft: number;
    totalBets: number;
    drawnNumbers: number[] | null;
    myBet: {
      picks: number[]; betAmount: string; mode: string;
      hitCount?: number; multiplier?: number; payout?: number; newBalance?: number;
    } | null;
  } | null>(null);
  const [betPlaced, setBetPlaced] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const lastAnimatedRoundRef = useRef<number | null>(null);

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

  // ── Poll shared round state from server ───────────────────────────────────
  useEffect(() => {
    if (!mode) return;
    let stopped = false;
    async function poll() {
      while (!stopped) {
        try {
          const res = await apiFetch("/api/games/keno/state");
          if (res.ok && !stopped) setRoundState(await res.json());
        } catch { /* ignore */ }
        await new Promise<void>(r => setTimeout(r, 1200));
      }
    }
    poll();
    return () => { stopped = true; };
  }, [mode]);

  // ── Smooth local countdown (seeded from server, decrements locally) ────────
  useEffect(() => {
    if (!roundState) return;
    setCountdown(roundState.phase === "betting" ? roundState.secondsLeft : 0);
  }, [roundState?.roundId, roundState?.phase, roundState?.secondsLeft]);

  useEffect(() => {
    if (!roundState || roundState.phase !== "betting" || animating) return;
    const id = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [roundState?.roundId, roundState?.phase, animating]);

  // ── Trigger shared draw animation when round enters drawing phase ──────────
  useEffect(() => {
    if (!roundState) return;
    if (roundState.phase !== "drawing") return;
    if (!roundState.drawnNumbers?.length) return;
    if (lastAnimatedRoundRef.current === roundState.roundId) return;

    lastAnimatedRoundRef.current = roundState.roundId;
    const drawn      = roundState.drawnNumbers;
    const myBetSnap  = roundState.myBet;
    const currentMode = mode;

    let cancelled = false;

    async function animate() {
      setAnimating(true);
      setRevealedNums([]);
      setActiveDrawNumber(null);
      setDrawProgress(0);

      for (let i = 0; i < drawn.length; i++) {
        if (cancelled) return;
        setActiveDrawNumber(drawn[i]);
        await new Promise<void>(r => setTimeout(r, 560));
        if (cancelled) return;
        setRevealedNums(prev => [...prev, drawn[i]]);
        setDrawProgress(i + 1);
        await new Promise<void>(r => setTimeout(r, 110));
      }

      if (cancelled) return;
      await new Promise<void>(r => setTimeout(r, 400));
      setActiveDrawNumber(null);
      setRevealedNums([]);   // clear drawn numbers so grid resets for next round
      setDrawProgress(0);
      setAnimating(false);
      setBetPlaced(false); // unlock for next round

      // Show result overlay only if user placed a bet
      if (myBetSnap && myBetSnap.hitCount !== undefined) {
        setResult({
          drawn,
          picks:       myBetSnap.picks,
          hitCount:    myBetSnap.hitCount,
          multiplier:  myBetSnap.multiplier!,
          payout:      myBetSnap.payout!,
          betAmount:   parseFloat(myBetSnap.betAmount),
        });
        if (currentMode === "real") {
          setWallet(prev => prev ? { ...prev, realBalance: String(myBetSnap.newBalance) } : prev);
        } else {
          setWallet(prev => prev ? { ...prev, demoBalance: String(myBetSnap.newBalance) } : prev);
        }
      }

      await loadHistory();
    }

    animate();
    return () => { cancelled = true; };
  }, [roundState?.roundId, roundState?.phase]);

  function toggleNumber(n: number) {
    if (animating || betPlaced) return;
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
    if (!animating && !betPlaced) setSelectedNums([]);
  }

  const balance = mode === "real"
    ? parseFloat(wallet?.realBalance ?? "0")
    : parseFloat(wallet?.demoBalance ?? "10000");

  const bet = parseFloat(betAmount);
  const settings = wallet?.settings;
  const canBet = (
    !betPlaced &&
    !animating &&
    roundState?.phase === "betting" &&
    (roundState?.secondsLeft ?? 0) > 0 &&
    selectedNums.length >= 1 &&
    !isNaN(bet) && bet > 0 &&
    bet <= balance &&
    (!settings || (bet >= parseFloat(settings.minBet) && bet <= parseFloat(settings.maxBet))) &&
    (settings?.gameEnabled !== false)
  );

  async function handleBet() {
    if (!canBet || !mode) return;
    try {
      const res = await apiFetch("/api/games/keno/bet", {
        method: "POST",
        body: JSON.stringify({ picks: selectedNums, betAmount: bet.toFixed(2), mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ description: data.error ?? "Bet failed", variant: "destructive" });
        return;
      }
      setBetPlaced(true);
      // Reflect deducted balance immediately
      if (mode === "real") {
        setWallet(prev => prev ? { ...prev, realBalance: String(data.balanceAfterDeduction) } : prev);
      } else {
        setWallet(prev => prev ? { ...prev, demoBalance: String(data.balanceAfterDeduction) } : prev);
      }
    } catch {
      toast({ description: "Network error", variant: "destructive" });
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
    <AppLayout showNav={false} wide>
      <div className="min-h-screen bg-[#121719] text-slate-100">
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#171c1d] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="button-exit-keno"
              onClick={() => { setMode(null); setSelectedNums([]); setRevealedNums([]); setResult(null); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Exit Keno"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-[0.22em] text-white">XENDRX<span className="text-emerald-400">KENO</span></span>
                {mode === "demo" && <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Demo</span>}
              </div>
              <p className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">Pick your numbers · play your way</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Player</p>
              <p className="text-xs font-semibold text-slate-300">ID: {user?.id ?? "Guest"}</p>
            </div>
            <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
              {balance.toFixed(2)} <span className="text-[10px] font-medium text-emerald-400/70">{mode === "demo" ? "DEMO" : "USDT"}</span>
            </div>
            {mode === "real" && (
              <button type="button" data-testid="button-topup-keno" onClick={() => setShowTopUp(true)} className="hidden rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-[#10221c] transition hover:bg-emerald-400 sm:block">
                Top up
              </button>
            )}
            {mode === "demo" && balance < 1 && (
              <button type="button" data-testid="button-reset-demo" onClick={resetDemo} disabled={resettingDemo} className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-[#10221c] disabled:opacity-50">
                {resettingDemo ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reset"}
              </button>
            )}
            <button type="button" data-testid="button-toggle-keno-history" onClick={() => setShowHistory(s => !s)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Toggle game history">
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1440px] gap-3 p-3 sm:p-5 lg:grid-cols-[235px_minmax(0,1fr)_280px] lg:gap-4 lg:p-6">
          <aside className={`${showHistory ? "block" : "hidden"} rounded-xl border border-white/10 bg-[#1b2324] lg:block`}>
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
                <button type="button" data-testid="button-game-tab" className="border-b-2 border-emerald-400 pb-2 text-emerald-300">Game</button>
                <button type="button" data-testid="button-history-tab" onClick={() => setShowHistory(true)} className="pb-2 text-slate-500 hover:text-slate-200">History</button>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                <span>My tickets</span>
                <span>{history.length} rounds</span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto p-2">
              {history.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-xs text-slate-500">Your tickets will appear here after a draw.</div>
              )}
              {history.map((round, index) => (
                <div key={round.id} data-testid={`card-keno-ticket-${round.id}`} className="rounded-lg border border-white/5 bg-[#222c2d] p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Ticket {history.length - index}</span>
                    <span className={`text-[10px] font-bold ${parseFloat(round.payoutAmount) > 0 ? "text-emerald-300" : "text-slate-500"}`}>
                      {parseFloat(round.payoutAmount) > 0 ? `+${parseFloat(round.payoutAmount).toFixed(2)}` : "No win"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {round.picks.map(pick => (
                      <span key={pick} className={`flex h-6 min-w-6 items-center justify-center rounded bg-[#334043] px-1 text-[10px] font-bold ${round.drawnNumbers.includes(pick) ? "bg-emerald-500 text-[#10221c]" : "text-slate-300"}`}>{pick}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-slate-500">
                    <span>Bet {parseFloat(round.betAmount).toFixed(2)}</span>
                    <span>{round.hitCount}/{round.picks.length} hits</span>
                  </div>
                </div>
              ))}
            </div>
            {mode === "real" && (
              <div className="border-t border-white/10 p-3">
                <button type="button" data-testid="button-withdraw-keno" onClick={() => setShowWithdraw(true)} className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-300">
                  Withdraw to main wallet
                </button>
              </div>
            )}
          </aside>

          <main className="min-w-0">
            <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-[#273335]">
              {/* ── Countdown bar ───────────────────────────────────────── */}
              {!animating && roundState?.phase === "betting" && (
                <div className="relative h-1 w-full overflow-hidden bg-white/5">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${
                      countdown <= 5
                        ? "bg-red-500"
                        : countdown <= 10
                        ? "bg-orange-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${(countdown / 30) * 100}%` }}
                  />
                </div>
              )}
              <div className="relative flex min-h-[112px] items-center justify-between overflow-hidden px-5 py-5 sm:px-8">
                <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border-[18px] border-emerald-400/5" />
                <div className="pointer-events-none absolute -right-20 top-10 h-40 w-40 rounded-full border-[14px] border-cyan-300/5" />
                {animating && activeDrawNumber !== null && (
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                    role="status"
                    aria-live="polite"
                    aria-label={`Number ${activeDrawNumber} of ${drawProgress} drawn`}
                  >
                    <div className="keno-draw-orbit absolute h-28 w-28 rounded-full border border-cyan-300/20" />
                    <div className="keno-draw-orbit keno-draw-orbit-delayed absolute h-20 w-20 rounded-full border border-emerald-300/20" />
                    <div className={`keno-draw-ball relative flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-black ${selectedNums.includes(activeDrawNumber) ? "border-emerald-200 bg-emerald-400 text-[#10221c] shadow-emerald-400/60" : "border-cyan-200 bg-[#1d5960] text-white shadow-cyan-400/60"}`}>
                      {activeDrawNumber}
                      {selectedNums.includes(activeDrawNumber) && <Check className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-200 p-0.5 text-[#10221c]" />}
                    </div>
                    <div className="absolute top-2 text-[9px] font-black uppercase tracking-[0.28em] text-cyan-200/80">
                      Draw {drawProgress} / 20
                    </div>
                  </div>
                )}
                <div className="relative z-20">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    {animating
                      ? "Drawing numbers — shared draw!"
                      : betPlaced
                      ? "Bet placed ✓ — waiting for draw…"
                      : roundState?.phase === "drawing"
                      ? "Drawing numbers…"
                      : "Betting open — place your numbers!"}
                  </p>
                  <h2 className="text-xl font-black text-white sm:text-2xl">Choose up to 10 numbers</h2>
                  <p className="mt-1 text-sm font-semibold text-cyan-300">
                    From 1 to 80 · {selectedNums.length} selected
                    {(roundState?.totalBets ?? 0) > 0 && !animating && (
                      <span className="ml-2 text-slate-400">· {roundState!.totalBets} player{roundState!.totalBets !== 1 ? "s" : ""} betting</span>
                    )}
                  </p>
                </div>

                {/* ── Countdown ring / draw progress ──────────────────── */}
                <div className="relative z-20 flex flex-col items-center gap-1">
                  {animating ? (
                    /* Draw progress ring */
                    <div className="relative flex h-16 w-16 items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                        <circle
                          cx="32" cy="32" r="28" fill="none"
                          stroke="#22d3ee"
                          strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - drawProgress / 20)}`}
                          strokeLinecap="round"
                          className="transition-all duration-200"
                        />
                      </svg>
                      <span className="font-mono text-lg font-black text-white">{drawProgress}<span className="text-[10px] text-slate-400">/20</span></span>
                    </div>
                  ) : (
                    /* Betting countdown ring */
                    <div className="relative flex h-16 w-16 items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                        <circle
                          cx="32" cy="32" r="28" fill="none"
                          stroke={countdown <= 5 ? "#ef4444" : countdown <= 10 ? "#fb923c" : "#34d399"}
                          strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 30)}`}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-linear"
                        />
                      </svg>
                      <span className={`font-mono text-2xl font-black ${countdown <= 5 ? "text-red-400" : countdown <= 10 ? "text-orange-400" : "text-emerald-300"}`}>
                        {countdown}
                      </span>
                    </div>
                  )}
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    {animating ? "Drawing" : "Seconds left"}
                  </p>
                </div>

                <button type="button" data-testid="button-open-paytable" onClick={() => setShowPaytable(true)} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300 hover:bg-cyan-300/20" aria-label="Open payout information">
                  <CircleHelp className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#1b2324] p-2 sm:p-3">
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
                  const isSelected = selectedNums.includes(n);
                  const isDrawn = revealedNums.includes(n);
                  const isHit = isSelected && isDrawn;
                  const isActive = activeDrawNumber === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      data-testid={`button-keno-number-${n}`}
                      onClick={() => toggleNumber(n)}
                      className={`relative aspect-square rounded-md text-xs font-bold transition-all sm:rounded-lg sm:text-sm ${isHit ? "scale-105 bg-emerald-400 text-[#10221c] shadow-lg shadow-emerald-400/20" : isSelected ? "border-2 border-cyan-300 bg-cyan-300/20 text-cyan-200" : isDrawn ? "bg-[#303b3d] text-slate-600" : "bg-[#2a3436] text-slate-400 hover:bg-[#344143] hover:text-white"} ${isActive ? "keno-number-reveal" : ""} ${animating ? "cursor-not-allowed" : ""}`}
                    >
                      {isHit && <Check className="absolute right-1 top-1 h-2.5 w-2.5" />}
                      {n}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-slate-200">{selectedNums.length}/10</span> numbers selected
                  {rtp !== null && <span className="text-emerald-300">· RTP {(rtp * 100).toFixed(0)}%</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" data-testid="button-clear-keno-selection" onClick={clearSelections} disabled={selectedNums.length === 0} className="text-xs font-bold text-slate-500 hover:text-white disabled:opacity-30">Clear</button>
                  <button type="button" data-testid="button-show-payouts" onClick={() => setShowPaytable(true)} className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200"><Info className="h-3 w-3" /> Payouts</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-2">
                <div className="flex items-center rounded-lg border border-white/10 bg-[#263133]">
                  <button type="button" data-testid="button-decrease-bet" onClick={() => setBetAmount(Math.max(0.1, bet - 0.1).toFixed(2))} className="flex h-11 w-10 items-center justify-center text-slate-400 hover:text-white"><Minus className="h-4 w-4" /></button>
                  <label className="flex flex-1 items-center justify-center gap-1 text-sm font-black text-white">
                    <input type="number" data-testid="input-keno-bet" value={betAmount} onChange={e => setBetAmount(e.target.value)} min={settings?.minBet ?? "0.10"} max={settings?.maxBet ?? "100"} step="0.10" className="w-16 bg-transparent text-center outline-none" aria-label="Bet amount" />
                    <span className="text-[10px] font-bold text-slate-500">USDT</span>
                  </label>
                  <button type="button" data-testid="button-increase-bet" onClick={() => setBetAmount((bet + 0.1).toFixed(2))} className="flex h-11 w-10 items-center justify-center text-slate-400 hover:text-white"><Plus className="h-4 w-4" /></button>
                </div>
                <button type="button" data-testid="button-double-bet" onClick={() => setBetAmount((bet * 2).toFixed(2))} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-black text-emerald-300 hover:bg-emerald-400/20">X2</button>
                <button type="button" data-testid="button-max-bet" onClick={() => setBetAmount(settings?.maxBet ?? "100.00")} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-black text-emerald-300 hover:bg-emerald-400/20">MAX</button>
                <button type="button" data-testid="button-play-keno" onClick={handleBet} disabled={!canBet} className={`min-w-[92px] rounded-lg px-4 text-sm font-black uppercase tracking-wider shadow-lg transition disabled:cursor-not-allowed disabled:opacity-35 ${betPlaced ? "bg-emerald-700 text-emerald-200" : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#10221c] hover:from-emerald-400 hover:to-cyan-300 shadow-emerald-500/10"}`}>
                  {animating ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : betPlaced ? <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Placed</span> : "Bet"}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
                <span>{settings ? `${settings.minBet}–${settings.maxBet} USDT per round` : "Select 1–10 numbers to play"}</span>
                <span>Balance {balance.toFixed(2)}</span>
              </div>
            </div>
          </main>

          <aside className="hidden rounded-xl border border-white/10 bg-[#1b2324] lg:block">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1 border-b-2 border-emerald-400 pb-2 text-emerald-300"><Check className="h-3 w-3" /> Results</span>
                <button type="button" data-testid="button-statistics" className="flex items-center gap-1 pb-2 text-slate-500 hover:text-slate-200"><BarChart3 className="h-3 w-3" /> Stats</button>
                <button type="button" data-testid="button-leaders" className="flex items-center gap-1 pb-2 text-slate-500 hover:text-slate-200"><Crown className="h-3 w-3" /> Leaders</button>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] text-[10px] text-slate-500">
                <span>Draw ID</span><span>Combination</span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-2">
              {history.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">Results will show here.</p>}
              {history.map(round => (
                <div key={round.id} data-testid={`row-keno-result-${round.id}`} className="mb-1 rounded-lg bg-[#273335] p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 font-semibold text-emerald-300"><Check className="h-3 w-3" /> #{round.id}</span>
                    <span className="text-slate-500">{new Date(round.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-5 gap-1">
                    {round.drawnNumbers.slice(0, 10).map(number => (
                      <span key={number} className={`rounded bg-[#344144] py-0.5 text-center text-[9px] font-bold ${round.picks.includes(number) ? "bg-emerald-500/80 text-[#10221c]" : "text-slate-400"}`}>{number}</span>
                    ))}
                  </div>
                  <div className="mt-1 text-right text-[10px] font-bold text-slate-500">{round.hitCount} hits · {parseFloat(round.multiplier).toFixed(2)}×</div>
                </div>
              ))}
            </div>
          </aside>
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
          maxAmount={parseFloat(mainWallet?.availableBalance ?? "0")}
          settings={wallet.settings}
          onClose={() => setShowTopUp(false)}
          onSuccess={(bal) => {
            setWallet(prev => prev ? { ...prev, realBalance: bal } : prev);
            queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
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
            queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
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
