import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getGetWalletQueryKey, useGetWallet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, RefreshCw, TrendingUp, Info, ChevronDown, ChevronUp, Loader2, Trophy, X, Zap, Menu, CircleHelp, Minus, Plus, BarChart3, Crown, Check, ShieldCheck, Copy } from "lucide-react";
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
  batchId: number | null;
  roundId: number | null;
  picks: number[];
  drawnNumbers: number[];
  betAmount: string;
  hitCount: number;
  multiplier: string;
  payoutAmount: string;
  createdAt: string;
}

interface KenoStats {
  totalRounds: number;
  frequency: Record<number, number>;
}

interface KenoLeader {
  username: string;
  gamesPlayed: number;
  netProfit: string;
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
  const lookup = new Map(paytable.map(row => [`${row.picks}:${row.hits}`, row.multiplier]));

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center px-3 py-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#182021] rounded-2xl border border-white/10 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white">Payouts & winning combinations</h3>
            <p className="mt-1 text-xs text-slate-400">Multiplier × your bet amount · highlighted column is Pick {picksCount || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-white/5 text-slate-300">
                <th className="border-b border-r border-white/10 px-2 py-2 text-left font-bold">Hits \ Picks</th>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(picks => (
                  <th key={picks} className={`border-b border-white/10 px-2 py-2 font-black ${picks === picksCount ? "bg-cyan-400/15 text-cyan-300" : ""}`}>{picks}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 11 }, (_, hits) => (
                <tr key={hits} className="border-b border-white/5 last:border-0">
                  <th className="border-r border-white/10 bg-white/[0.03] px-2 py-2 text-left font-bold text-slate-400">{hits}</th>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(picks => {
                    const value = lookup.get(`${picks}:${hits}`);
                    const multiplier = value ? parseFloat(value) : 0;
                    const valid = hits <= picks && value !== undefined;
                    return (
                      <td key={picks} className={`px-2 py-2 font-bold ${picks === picksCount ? "bg-cyan-400/[0.08]" : ""} ${multiplier > 0 ? "text-emerald-300" : "text-slate-600"}`}>
                        {valid && multiplier > 0 ? `${multiplier.toFixed(2)}×` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {picksCount > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Pick {picksCount} pays when you match one of the winning ball combinations shown in the {picksCount} column. For example, a {picksCount}-hit result pays the multiplier on that row.
          </p>
        )}
      </div>
    </div>
  );
}

function FairnessSheet({
  roundState,
  drawn,
  onClose,
}: {
  roundState: {
    roundId: number;
    serverHash: string | null;
    seedTimestamp: number | null;
    serverSeedRevealed: string | null;
    drawTimestamp: number | null;
  } | null;
  drawn: number[];
  onClose: () => void;
}) {
  const [verification, setVerification] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [copied, setCopied] = useState(false);
  const seed = roundState?.serverSeedRevealed;
  const canVerify = Boolean(seed && roundState?.serverHash && roundState.seedTimestamp);

  async function verifyCommitment() {
    if (!canVerify || !seed || !roundState?.serverHash || !roundState.seedTimestamp) return;
    setVerification("checking");
    try {
      const input = `${seed}|${roundState.roundId}|${roundState.seedTimestamp}`;
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      const hash = Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("");
      setVerification(hash === roundState.serverHash ? "valid" : "invalid");
    } catch {
      setVerification("invalid");
    }
  }

  async function copyHash() {
    if (!roundState?.serverHash) return;
    await navigator.clipboard?.writeText(roundState.serverHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center px-3 py-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#182021] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h3 className="font-bold text-white">About fairness</h3>
              <p className="text-xs text-slate-400">Verify that the winning ball combination was committed before betting.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close fairness information"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <p>Before each round, XendrX Keno creates a secret server seed and publishes its SHA-256 hash. The winning combination is generated from that committed seed, the round ID, and the draw timestamp. The seed is revealed after the draw so anyone can check it.</p>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Round ID</p><p className="mt-1 font-mono text-xs text-white">{roundState?.roundId ?? "—"}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Draw timestamp</p><p className="mt-1 font-mono text-xs text-white">{roundState?.drawTimestamp ? new Date(roundState.drawTimestamp).toISOString() : "Shown after draw"}</p></div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Committed server hash</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 break-all text-[10px] text-cyan-300">{roundState?.serverHash ?? "Not available"}</code>
                {roundState?.serverHash && <button onClick={copyHash} className="shrink-0 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Copy server hash">{copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}</button>}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Revealed server seed</p>
              <code className="mt-1 block break-all text-[10px] text-emerald-300">{seed ?? "Hidden until the round is drawn"}</code>
            </div>
          </div>

          {drawn.length > 0 && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Winning ball combination · {drawn.length} balls</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {drawn.map((number, index) => <span key={`${number}-${index}`} className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-black text-[#10221c]">{number}</span>)}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={verifyCommitment} disabled={!canVerify || verification === "checking"} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-[#10221c] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
              <ShieldCheck className="h-3.5 w-3.5" /> {verification === "checking" ? "Checking…" : "Verify commitment"}
            </button>
            {verification === "valid" && <span className="text-xs font-bold text-emerald-300">Verified: the revealed seed matches the published hash.</span>}
            {verification === "invalid" && <span className="text-xs font-bold text-red-300">Could not verify this commitment. Please try again after the draw is complete.</span>}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">The commitment check verifies SHA-256(seed | round ID | seed timestamp). The draw engine then uses a deterministic HMAC-SHA-256 shuffle to select 20 unique numbers from 1–80. During betting, only the hash is visible; the seed stays hidden.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Ball tray (drawn numbers shown as round balls) ──────────────────────────

function KenoBallTray({
  drawnNumbers,
  activeNumber,
  totalExpected,
}: {
  drawnNumbers: number[];
  activeNumber: number | null;
  totalExpected: number;
}) {
  // Only the most-recently-added ball gets the slide-in animation.
  // Stable index keys ensure React never remounts settled balls, so
  // the CSS animation never replays on them.
  const newestIdx = drawnNumbers.length - 1;
  const slots = Array.from({ length: totalExpected }, (_, i) => drawnNumbers[i] ?? null);
  const row1 = slots.slice(0, 10);
  const row2 = slots.slice(10, 20);

  function Ball({ num, globalIdx }: { num: number | null; globalIdx: number }) {
    if (num === null) {
      return (
        <div className="h-7 w-7 flex-shrink-0 rounded-full border border-white/10 bg-white/5 sm:h-8 sm:w-8" />
      );
    }
    const isNewest = globalIdx === newestIdx;
    const isActive = num === activeNumber;
    return (
      <div
        className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black sm:h-8 sm:w-8 sm:text-xs
          ${isNewest ? "keno-ball-drop" : ""}
          ${isActive
            ? "bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-400/60 scale-110"
            : "bg-gradient-to-b from-gray-200 to-gray-400 text-gray-900 shadow-md shadow-black/40"
          }`}
      >
        {num}
        {/* Shine gloss */}
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/50 to-transparent opacity-60" style={{ clipPath: "ellipse(55% 45% at 38% 28%)" }} />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5 px-1">
      <div className="flex items-center gap-1 sm:gap-1.5">
        {row1.map((num, i) => <Ball key={i} num={num} globalIdx={i} />)}
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {row2.map((num, i) => <Ball key={i + 10} num={num} globalIdx={i + 10} />)}
      </div>
    </div>
  );
}

// ─── Result overlay (multi-ticket) ───────────────────────────────────────────

interface TicketResult {
  picks: number[];
  betAmount: number;
  hitCount: number;
  multiplier: number;
  payout: number;
}

interface CompletedRoundResult {
  roundId: number;
  drawn: number[];
  tickets: TicketResult[];
  totalPayout: number;
  updatedBalance: number;
  mode: "demo" | "real";
}

function ResultOverlay({
  drawn,
  tickets,
  totalPayout,
  updatedBalance,
  mode,
  onClose,
}: {
  drawn: number[];
  tickets: TicketResult[];
  totalPayout: number;
  updatedBalance: number;
  mode: "demo" | "real";
  onClose: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const ticket = tickets[activeIdx] ?? tickets[0];
  const won = totalPayout > 0;

  return (
    <div className="fixed inset-0 z-[9996] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl border border-border p-5 text-center space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${won ? "bg-emerald-600/20" : "bg-muted/30"}`}>
          {won ? <Trophy className="w-7 h-7 text-emerald-400" /> : <X className="w-7 h-7 text-muted-foreground" />}
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{won ? "Round complete!" : "No wins this round"}</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalPayout > 0 ? `+${totalPayout.toFixed(2)}` : "0.00"} <span className="text-base font-medium text-emerald-400/70">USDT</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} played</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Win Amount ($)</p>
            <p className="mt-1 text-base font-black text-emerald-300">${totalPayout.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Updated {mode === "demo" ? "Demo " : ""}Balance
            </p>
            <p className="mt-1 text-base font-black text-white">${updatedBalance.toFixed(2)}</p>
          </div>
        </div>

        {/* Ticket tabs */}
        {tickets.length > 1 && (
          <div className="flex gap-1.5 justify-center flex-wrap">
            {tickets.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  i === activeIdx
                    ? "bg-emerald-500 text-[#10221c]"
                    : t.payout > 0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10"
                }`}
              >
                T{i + 1} {t.payout > 0 ? `+${t.payout.toFixed(2)}` : "×"}
              </button>
            ))}
          </div>
        )}

        {/* Active ticket detail */}
        {ticket && (
          <div className="rounded-xl border border-white/10 bg-[#1b2324] p-3 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Ticket {activeIdx + 1}</span>
              <span className={ticket.payout > 0 ? "text-emerald-400 font-bold" : "text-slate-500"}>
                {ticket.hitCount} hit{ticket.hitCount !== 1 ? "s" : ""} · {ticket.multiplier}× · {ticket.payout > 0 ? `+$${ticket.payout.toFixed(2)}` : "no win"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-white/5 px-1.5 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Hits Matched</p>
                <p className="mt-1 text-sm font-black text-white">{ticket.hitCount}/{ticket.picks.length}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-1.5 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Multiplier</p>
                <p className="mt-1 text-sm font-black text-cyan-300">{ticket.multiplier}x</p>
              </div>
              <div className="rounded-lg bg-white/5 px-1.5 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Win Amount ($)</p>
                <p className="mt-1 text-sm font-black text-emerald-300">${ticket.payout.toFixed(2)}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Selected Numbers</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ticket.picks.map(number => (
                  <span
                    key={number}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                      drawn.includes(number) ? "bg-emerald-400 text-[#10221c]" : "bg-[#344144] text-slate-200"
                    }`}
                  >
                    {number}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {[...drawn].sort((a, b) => a - b).map(n => {
                const isHit = ticket.picks.includes(n);
                return (
                  <div key={n} className={`aspect-square rounded text-[9px] font-bold flex items-center justify-center ${isHit ? "bg-emerald-600 text-white" : "bg-[#263133] text-slate-500"}`}>
                    {n}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/10 pt-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Winning ball combination</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {drawn.map((number, index) => (
                  <span key={`${number}-${index}`} className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[9px] font-black ${ticket.picks.includes(number) ? "bg-emerald-400 text-[#10221c]" : "bg-[#344144] text-slate-300"}`}>
                    {number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors">
          Try Again
        </button>
      </div>
    </div>
  );
}

// ─── Ticket draft type ────────────────────────────────────────────────────────

interface TicketDraft {
  picks: number[];
  betAmount: string;
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
  const [globalRounds, setGlobalRounds] = useState<{ roundId: number; drawnNumbers: number[]; drawnAt: string }[]>([]);
  const [rightTab, setRightTab] = useState<"results" | "stats" | "leaders">("results");
  const [kenoStats, setKenoStats] = useState<KenoStats | null>(null);
  const [kenoLeaders, setKenoLeaders] = useState<KenoLeader[]>([]);

  // ── Per-ticket state ──────────────────────────────────────────────────────
  // currentPicks / currentBetAmount = what the user is picking RIGHT NOW
  // Each Place Bet submits one ticket immediately; user can keep adding up to 20
  const [currentPicks, setCurrentPicks] = useState<number[]>([]);
  const [currentBetAmount, setCurrentBetAmount] = useState("1.00");
  // Tickets placed this round (with their picked numbers, for display)
  const [placedTickets, setPlacedTickets] = useState<{ picks: number[]; betAmount: string }[]>([]);

  const [animating, setAnimating] = useState(false);
  const [revealedNums, setRevealedNums] = useState<number[]>([]);
  const [activeDrawNumber, setActiveDrawNumber] = useState<number | null>(null);
  const [drawProgress, setDrawProgress] = useState(0);

  const [batchResult, setBatchResult] = useState<CompletedRoundResult | null>(null);
  // Keep the settled ticket in the game view until the next betting phase.
  // This is intentionally separate from batchResult because the modal can be
  // dismissed while the player still needs to inspect the round result.
  const [completedRoundResult, setCompletedRoundResult] = useState<CompletedRoundResult | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showFairness, setShowFairness] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"game" | "history">("game");
  const [resettingDemo, setResettingDemo] = useState(false);

  // ── Multiplayer round state ───────────────────────────────────────────────
  const [roundState, setRoundState] = useState<{
    roundId: number;
    phase: "betting" | "drawing";
    secondsLeft: number;
    totalBets: number;
    drawnNumbers: number[] | null;
    myBatch: {
      mode: string; totalStaked: string; ticketCount: number;
      tickets: { picks: number[]; betAmount: string; hitCount?: number; multiplier?: number; payout?: number }[];
      totalPayout?: number; newBalance?: number;
    } | null;
    // Provably fair fields
    serverHash: string | null;
    seedTimestamp: number | null;
    serverSeedRevealed: string | null;
    drawTimestamp: number | null;
    status: string | null;
  } | null>(null);
  // How many tickets the user has placed in the current round (resets each draw)
  const [ticketsThisRound, setTicketsThisRound] = useState(0);
  const lastRoundIdRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState(30);

  const lastAnimatedRoundRef = useRef<number | null>(null);
  const animCancelledRef = useRef(false);
  useEffect(() => {
    animCancelledRef.current = false;
    return () => { animCancelledRef.current = true; };
  }, []);


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
      const res = await apiFetch(`/api/games/keno/history?mode=${mode}&limit=50`);
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  }

  async function loadGlobalRounds() {
    try {
      const res = await apiFetch("/api/games/keno/rounds?limit=20");
      if (res.ok) setGlobalRounds(await res.json());
    } catch { /* ignore */ }
  }

  async function loadStats() {
    try {
      const res = await apiFetch("/api/games/keno/stats");
      if (res.ok) setKenoStats(await res.json());
    } catch { /* ignore */ }
  }

  async function loadLeaders() {
    try {
      const res = await apiFetch("/api/games/keno/leaders");
      if (res.ok) setKenoLeaders(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (mode) {
      loadWallet();
      loadPaytable();
      loadHistory();
      loadGlobalRounds();
      loadStats();
    }
  }, [mode]);

  // ── Poll shared round state from server ───────────────────────────────────
  useEffect(() => {
    if (!mode) return;
    let stopped = false;
    async function poll() {
      while (!stopped) {
        try {
          const res = await apiFetch(`/api/games/keno/state?mode=${mode}`);
          if (res.ok && !stopped) setRoundState(await res.json());
        } catch { /* ignore */ }
        await new Promise<void>(r => setTimeout(r, 1200));
      }
    }
    poll();
    return () => { stopped = true; };
  }, [mode]);

  // ── Smooth local countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (!roundState) return;
    setCountdown(roundState.secondsLeft);
  }, [roundState?.roundId, roundState?.phase, roundState?.secondsLeft]);

  useEffect(() => {
    if (!roundState || roundState.phase !== "betting" || animating) return;
    const id = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [roundState?.roundId, roundState?.phase, animating]);

  // ── Trigger draw animation when round enters drawing phase ────────────────
  useEffect(() => {
    if (!roundState) return;
    if (roundState.phase !== "drawing") return;
    if (!roundState.drawnNumbers?.length) return;
    if (lastAnimatedRoundRef.current === roundState.roundId) return;

    lastAnimatedRoundRef.current = roundState.roundId;
    // Preserve the backend's draw order so highlights jump across the grid.
    const drawn        = roundState.drawnNumbers;
    const myBatchSnap  = roundState.myBatch;
    const currentMode  = mode;

    async function animate() {
      setAnimating(true);
      setRevealedNums([]);
      setActiveDrawNumber(null);
      setDrawProgress(0);

      for (let i = 0; i < drawn.length; i++) {
        if (animCancelledRef.current) return;
        setRevealedNums(prev => [...prev, drawn[i]]);
        setActiveDrawNumber(drawn[i]);
        setDrawProgress(i + 1);
        await new Promise<void>(r => setTimeout(r, 350));
      }

      if (animCancelledRef.current) return;
      await new Promise<void>(r => setTimeout(r, 400));
      setActiveDrawNumber(null);
      setDrawProgress(0);
      setAnimating(false);

      // Keep the final numbers visible while the server holds the round open.
      // The settled snapshot was captured below before the animation started.
      if (snapshotResult) {
        setBatchResult(snapshotResult);
      }

      await loadHistory();
      await loadGlobalRounds();
    }

    const snapshotResult = myBatchSnap && myBatchSnap.totalPayout !== undefined && myBatchSnap.tickets.every(t => t.hitCount !== undefined)
      ? {
          roundId: roundState.roundId,
          drawn,
          tickets: myBatchSnap.tickets.map(t => ({
            picks:      t.picks,
            betAmount:  parseFloat(t.betAmount),
            hitCount:   t.hitCount!,
            multiplier: t.multiplier!,
            payout:     t.payout!,
          })),
          totalPayout: myBatchSnap.totalPayout,
          updatedBalance: myBatchSnap.newBalance!,
          mode: currentMode!,
        }
      : null;

    // Settlement is complete before the drawing phase is sent to clients.
    // Publish it immediately so the ticket/result is not lost between the
    // animation and the next betting round.
    if (snapshotResult) {
      setCompletedRoundResult(snapshotResult);
      if (currentMode === "real") {
        setWallet(prev => prev ? { ...prev, realBalance: String(myBatchSnap!.newBalance) } : prev);
      } else {
        setWallet(prev => prev ? { ...prev, demoBalance: String(myBatchSnap!.newBalance) } : prev);
      }
    }

    animate();
  }, [roundState?.roundId, roundState?.phase]);

  // ── Reset ticket counter when a new round's betting phase starts ──────────
  useEffect(() => {
    if (!roundState) return;
    if (roundState.phase === "betting" && roundState.roundId !== lastRoundIdRef.current) {
      lastRoundIdRef.current = roundState.roundId;
      setTicketsThisRound(0);
      setPlacedTickets([]);
      setCompletedRoundResult(null);
      setBatchResult(null);
      setRevealedNums([]);
      // Reload results + user history now that the previous round is saved to DB
      loadGlobalRounds();
      loadHistory();
    }
  }, [roundState?.roundId, roundState?.phase]);

  // ── Ticket management ─────────────────────────────────────────────────────

  function toggleNumber(n: number) {
    if (animating) return;
    setCurrentPicks(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= 20) {
        toast({ description: "Maximum 20 numbers per ticket", variant: "destructive" });
        return prev;
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  function resetAllTickets() {
    setCurrentPicks([]);
    setCurrentBetAmount("1.00");
    setPlacedTickets([]);
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const balance = mode === "real"
    ? parseFloat(wallet?.realBalance ?? "0")
    : parseFloat(wallet?.demoBalance ?? "10000");

  const settings = wallet?.settings;
  const activeBet = parseFloat(currentBetAmount || "1.00");

  const MAX_TICKETS_PER_ROUND = 20;

  /** Can submit the current picks immediately */
  const canPlace = (
    !animating &&
    ticketsThisRound < MAX_TICKETS_PER_ROUND &&
    roundState?.phase === "betting" &&
    (roundState?.secondsLeft ?? 0) > 0 &&
    currentPicks.length === 20 &&
    !isNaN(activeBet) && activeBet > 0 &&
    activeBet <= balance &&
    (!settings || (activeBet >= parseFloat(settings.minBet) && activeBet <= parseFloat(settings.maxBet))) &&
    (settings?.gameEnabled !== false)
  );

  async function handlePlace() {
    if (!canPlace || !mode) return;
    const payload = [{ picks: currentPicks, betAmount: activeBet.toFixed(2) }];
    try {
      const res = await apiFetch("/api/games/keno/bet-batch", {
        method: "POST",
        body: JSON.stringify({ tickets: payload, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ description: data.error ?? "Bet failed", variant: "destructive" });
        return;
      }
      setTicketsThisRound(prev => prev + 1);
      setPlacedTickets(prev => [...prev, { picks: currentPicks, betAmount: activeBet.toFixed(2) }]);
      setCurrentPicks([]); // clear grid so user can pick next ticket
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

  const rtp = currentPicks.length > 0 ? calcRtp(currentPicks.length, paytable) : null;
  const frequencyValues = kenoStats ? Object.values(kenoStats.frequency) : [];
  const sortedFrequencies = [...frequencyValues].sort((a, b) => a - b);
  const hotCutoff = sortedFrequencies.length ? sortedFrequencies[Math.floor(sortedFrequencies.length * 0.75)] : 0;
  const coldCutoff = sortedFrequencies.length ? sortedFrequencies[Math.floor(sortedFrequencies.length * 0.25)] : 0;
  const currentRoundWin = completedRoundResult?.totalPayout ?? 0;

  return (
    <AppLayout showNav={false} wide>
      <div className="min-h-screen bg-[#121719] text-slate-100">
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#171c1d] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="button-exit-keno"
              onClick={() => { setMode(null); resetAllTickets(); setRevealedNums([]); setBatchResult(null); }}
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
            {currentRoundWin > 0 && roundState?.phase === "drawing" && (
              <div
                data-testid="keno-header-win"
                className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-lg shadow-emerald-500/10"
                aria-live="polite"
              >
                Win +{currentRoundWin.toFixed(2)} USDT
              </div>
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
                <button
                  type="button"
                  data-testid="button-game-tab"
                  onClick={() => setSidebarTab("game")}
                  className={`pb-2 transition-colors ${sidebarTab === "game" ? "border-b-2 border-emerald-400 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}
                >
                  Game
                </button>
                <button
                  type="button"
                  data-testid="button-history-tab"
                  onClick={() => { setSidebarTab("history"); loadHistory(); }}
                  className={`pb-2 transition-colors ${sidebarTab === "history" ? "border-b-2 border-emerald-400 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}
                >
                  History
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                <span>{sidebarTab === "history" ? "Past rounds" : "My tickets"}</span>
                <span>{history.length} rounds</span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto p-2">
              {sidebarTab === "game" ? (
                <>
                  {ticketsThisRound === 0 && !animating && (
                    <div className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-xs text-slate-500">Pick numbers and place a bet — your tickets will appear here.</div>
                  )}
                  {animating && (
                    <div className="mb-2 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-3 text-center">
                      <Loader2 className="mx-auto mb-1.5 h-5 w-5 animate-spin text-yellow-300" />
                      <p className="text-sm font-black text-yellow-300">Drawing…</p>
                    </div>
                  )}
                  {placedTickets.length > 0 && (
                    <div className="space-y-2">
                      {!animating && !completedRoundResult && (
                        <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          {placedTickets.length} ticket{placedTickets.length !== 1 ? "s" : ""} placed · waiting for draw…
                        </p>
                      )}
                      {!animating && completedRoundResult && (
                        <div className={`rounded-lg border px-2 py-2 text-[10px] ${
                          completedRoundResult.totalPayout > 0
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}>
                          <p className="font-black uppercase tracking-wider">
                            Round #{completedRoundResult.roundId} settled
                          </p>
                          <p className="mt-0.5 font-bold">
                            {completedRoundResult.totalPayout > 0
                              ? `Won +${completedRoundResult.totalPayout.toFixed(2)} USDT`
                              : "No win — try again next round"}
                          </p>
                        </div>
                      )}
                      {placedTickets.map((ticket, idx) => (
                        <div key={idx} className="rounded-lg border border-white/5 bg-[#222c2d] p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300">Ticket {idx + 1}</span>
                            <span className="text-[10px] text-slate-400">{ticket.betAmount} USDT</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {ticket.picks.map(pick => {
                              const isDrawn = revealedNums.includes(pick);
                              const isHit = isDrawn;
                              return (
                                <span
                                  key={pick}
                                  className={`flex h-6 min-w-[24px] items-center justify-center rounded px-1 text-[10px] font-bold transition-colors ${
                                    isHit
                                      ? "bg-yellow-400 text-gray-900"
                                      : isDrawn
                                      ? "bg-slate-600 text-slate-300"
                                      : "bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/50"
                                  }`}
                                >
                                  {pick}
                                </span>
                              );
                            })}
                          </div>
                          <div className="mt-1.5 text-[10px] text-slate-500">{ticket.picks.length} number{ticket.picks.length !== 1 ? "s" : ""} chosen</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {history.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-xs text-slate-500">No rounds played yet.</div>
                  )}
                  {(() => {
                    // Group tickets by roundId (multiplayer) or batchId (instant)
                    const groups = new Map<string, KenoRound[]>();
                    for (const ticket of history) {
                      const key = ticket.roundId != null ? `r${ticket.roundId}` : `b${ticket.batchId ?? ticket.id}`;
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(ticket);
                    }
                    return Array.from(groups.entries()).map(([key, tickets]) => {
                      const first = tickets[0];
                      const drawn = new Set(first.drawnNumbers);
                      const totalPayout = tickets.reduce((s, t) => s + parseFloat(t.payoutAmount), 0);
                      const totalBet    = tickets.reduce((s, t) => s + parseFloat(t.betAmount), 0);
                      const isWin = totalPayout > totalBet;
                      return (
                        <div key={key} className="rounded-lg border border-white/5 bg-[#222c2d] p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-300">
                              {first.roundId != null ? `Draw #${first.roundId}` : "Instant"}
                            </span>
                            <span className="text-[10px] text-slate-500">{new Date(first.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          {/* Drawn numbers for this round */}
                          <div className="flex flex-wrap gap-0.5">
                            {first.drawnNumbers.map(n => (
                              <span key={n} className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-gray-200 to-gray-400 text-[8px] font-black text-gray-900">{n}</span>
                            ))}
                          </div>
                          {/* Each ticket */}
                          {tickets.map((ticket, ti) => (
                            <div key={ti} className="rounded border border-white/5 bg-[#1b2324] p-1.5">
                              <div className="mb-1 flex items-center justify-between text-[9px]">
                                <span className="text-slate-400">Ticket {ti + 1} · {ticket.betAmount} USDT · {ticket.hitCount} hit{ticket.hitCount !== 1 ? "s" : ""}</span>
                                <span className={parseFloat(ticket.payoutAmount) > 0 ? "font-bold text-emerald-400" : "text-slate-500"}>
                                  {parseFloat(ticket.payoutAmount) > 0 ? `+${parseFloat(ticket.payoutAmount).toFixed(2)}` : "0.00"} USDT
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-0.5">
                                {ticket.picks.map(n => (
                                  <span key={n} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${drawn.has(n) ? "bg-yellow-400 text-gray-900" : "bg-slate-700 text-slate-300"}`}>{n}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-500">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
                            <span className={isWin ? "font-bold text-emerald-400" : "text-slate-500"}>
                              Net: {isWin ? "+" : ""}{(totalPayout - totalBet).toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
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
            {/* ── Round number (Provably Fair runs silently in background) ── */}
            {roundState?.roundId != null && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">Round #{roundState.roundId}</p>
                <button type="button" onClick={() => setShowFairness(true)} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-400/10">
                  <ShieldCheck className="h-3 w-3" /> {roundState.serverSeedRevealed ? "Fairness verified after draw" : "Fairness committed"}
                </button>
              </div>
            )}

            {/* ── Drawn numbers — shown before the betting banner ───────── */}
            {(animating || revealedNums.length > 0) && (
              <div className="mb-3 rounded-xl border border-white/10 bg-[#1b2324] px-4 py-3">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Drawn numbers</p>
                <KenoBallTray drawnNumbers={revealedNums} activeNumber={activeDrawNumber} totalExpected={20} />
              </div>
            )}

            {completedRoundResult && !animating && (
              <div className={`mb-3 rounded-xl border px-5 py-4 ${
                completedRoundResult.totalPayout > 0
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-amber-400/30 bg-amber-400/10"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                      completedRoundResult.totalPayout > 0 ? "text-emerald-300" : "text-amber-300"
                    }`}>
                      Round #{completedRoundResult.roundId} result
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {completedRoundResult.totalPayout > 0
                        ? `You won +${completedRoundResult.totalPayout.toFixed(2)} USDT`
                        : "No win this round — try again"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {completedRoundResult.tickets.length} ticket{completedRoundResult.tickets.length !== 1 ? "s" : ""} ·{" "}
                      {completedRoundResult.tickets.reduce((sum, ticket) => sum + ticket.hitCount, 0)} total hit{completedRoundResult.tickets.reduce((sum, ticket) => sum + ticket.hitCount, 0) !== 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 grid gap-1.5 text-[11px] text-slate-300 sm:grid-cols-2">
                      {completedRoundResult.tickets.map((ticket, index) => (
                        <div key={index} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">Selected Numbers</span>
                            <span className="text-cyan-300">{ticket.multiplier}x</span>
                          </div>
                          <p className="mt-1 break-words text-[10px] text-slate-400">{ticket.picks.join(", ")}</p>
                          <p className="mt-1">
                            <span className="text-slate-400">Hits Matched:</span> {ticket.hitCount}/{ticket.picks.length}
                            <span className="ml-2 text-slate-400">Win Amount:</span> <span className="font-bold text-emerald-300">${ticket.payout.toFixed(2)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-bold text-white">
                      Updated {completedRoundResult.mode === "demo" ? "Demo " : ""}Balance: ${completedRoundResult.updatedBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">Next round</p>
                    <p className="text-sm font-bold text-white">Starts after results</p>
                    <p className="text-[10px] text-slate-400">{countdown}s remaining</p>
                  </div>
                </div>
              </div>
            )}

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
                {/* Status text during draw */}
                {animating && (
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-3"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="keno-status-pulse rounded-full bg-black/40 px-4 py-1 text-xs font-black uppercase tracking-[0.22em] text-yellow-300">
                      Good luck!
                    </span>
                  </div>
                )}
                <div className="relative z-20">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      {animating
                        ? "Drawing numbers — shared draw!"
                        : completedRoundResult
                        ? completedRoundResult.totalPayout > 0
                          ? "Round complete — winnings added to your balance"
                          : "Round complete — try again next round"
                      : ticketsThisRound > 0
                      ? `${ticketsThisRound} bet${ticketsThisRound !== 1 ? "s" : ""} placed ✓ — keep picking or wait for draw…`
                      : roundState?.phase === "drawing"
                      ? "Drawing numbers…"
                      : "Betting open — place your numbers!"}
                  </p>
                    <h2 className="text-xl font-black text-white sm:text-2xl">
                      {completedRoundResult && !animating
                        ? completedRoundResult.totalPayout > 0
                          ? `+${completedRoundResult.totalPayout.toFixed(2)} USDT won`
                          : "No winning numbers this round"
                        : "Choose exactly 20 numbers"}
                    </h2>
                  <p className="mt-1 text-sm font-semibold text-cyan-300">
                      {completedRoundResult && !animating
                        ? `${completedRoundResult.tickets.reduce((sum, ticket) => sum + ticket.hitCount, 0)} number${completedRoundResult.tickets.reduce((sum, ticket) => sum + ticket.hitCount, 0) !== 1 ? "s" : ""} matched · ticket saved in History`
                        : `From 1 to 80 · ${currentPicks.length} selected`}
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

              {/* ── Number grid ──────────────────────────────────────── */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {(() => {
                  // All picks across every placed ticket this round
                  const allPlacedPicksSet = new Set(placedTickets.flatMap(t => t.picks));
                  return Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
                    const isSelected = currentPicks.includes(n);
                    const isDrawn = revealedNums.includes(n);
                    // Drawn AND in one of the user's placed tickets → hit!
                    const isTicketHit = isDrawn && allPlacedPicksSet.has(n);
                    const isFlash = activeDrawNumber === n;
                    const frequency = kenoStats?.frequency[n] ?? 0;
                    const isHot = frequency > 0 && frequency >= hotCutoff && frequency > coldCutoff;
                    const isCold = frequency <= coldCutoff;
                    return (
                      <button
                        key={n}
                        type="button"
                        data-testid={`button-keno-number-${n}`}
                        onClick={() => toggleNumber(n)}
                        disabled={animating}
                        className={`relative aspect-square rounded-md text-xs font-bold transition-all sm:rounded-lg sm:text-sm
                          ${isTicketHit
                            ? "bg-emerald-400 text-gray-900 shadow-md shadow-emerald-400/60 ring-2 ring-white ring-offset-1 ring-offset-[#1b2324] scale-105"
                            : isDrawn
                            ? "bg-yellow-400 text-gray-900 shadow-sm shadow-yellow-400/30"
                            : isSelected
                            ? "bg-yellow-400 text-gray-900 shadow-md shadow-yellow-400/20 ring-2 ring-yellow-300 ring-offset-1 ring-offset-[#1b2324]"
                            : "bg-[#2a3436] text-slate-400 hover:bg-[#344143] hover:text-white"
                          }
                          ${isFlash ? "keno-cell-flash" : ""}
                          ${animating ? "cursor-not-allowed" : ""}
                        `}
                      >
                        {n}
                        {!isSelected && !isDrawn && (isHot || isCold) && (
                          <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${isHot ? "bg-red-400" : "bg-sky-400"}`} title={isHot ? `Hot number · drawn ${frequency} times` : `Cold number · drawn ${frequency} times`} />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-[9px] text-slate-500">
                <span className="font-bold uppercase tracking-wider text-slate-400">Number trends</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Hot · drawn often</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Cold · drawn less often</span>
              </div>

              {/* ── Selection info + Clear ───────────────────────────── */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-slate-200">{currentPicks.length}/20</span> selected
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" data-testid="button-clear-keno-selection" onClick={() => setCurrentPicks([])} disabled={currentPicks.length === 0 || animating} className="text-xs font-bold text-slate-500 hover:text-white disabled:opacity-30">Clear</button>
                  <button type="button" data-testid="button-show-payouts" onClick={() => setShowPaytable(true)} disabled={currentPicks.length === 0} className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-30"><Info className="h-3 w-3" /> Payouts</button>
                </div>
              </div>

              {/* ── Bet amount ───────────────────────────────────────── */}
              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                <div className="flex items-center rounded-lg border border-white/10 bg-[#263133]">
                  <button type="button" data-testid="button-decrease-bet" onClick={() => setCurrentBetAmount(Math.max(0.1, activeBet - 0.1).toFixed(2))} disabled={animating} className="flex h-11 w-10 items-center justify-center text-slate-400 hover:text-white disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                  <label className="flex flex-1 items-center justify-center gap-1 text-sm font-black text-white">
                    <input type="number" data-testid="input-keno-bet" value={currentBetAmount} onChange={e => setCurrentBetAmount(e.target.value)} min={settings?.minBet ?? "0.10"} max={settings?.maxBet ?? "100"} step="0.10" disabled={animating} className="w-16 bg-transparent text-center outline-none disabled:opacity-50" aria-label="Bet amount" />
                    <span className="text-[10px] font-bold text-slate-500">USDT</span>
                  </label>
                  <button type="button" data-testid="button-increase-bet" onClick={() => setCurrentBetAmount((activeBet + 0.1).toFixed(2))} disabled={animating} className="flex h-11 w-10 items-center justify-center text-slate-400 hover:text-white disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                </div>
                <button type="button" data-testid="button-double-bet" onClick={() => setCurrentBetAmount((activeBet * 2).toFixed(2))} disabled={animating} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-black text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30">X2</button>
                <button type="button" data-testid="button-max-bet" onClick={() => setCurrentBetAmount(settings?.maxBet ?? "100.00")} disabled={animating} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-black text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30">MAX</button>
              </div>

              {/* ── Place Bet button ──────────────────────────────────── */}
              <div className="mt-3">
                {/* Tickets placed this round indicator */}
                {ticketsThisRound > 0 && !animating && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                    <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-300">
                      {ticketsThisRound} ticket{ticketsThisRound !== 1 ? "s" : ""} placed this round
                    </span>
                    <span className="ml-auto text-[10px] text-slate-500">
                      {MAX_TICKETS_PER_ROUND - ticketsThisRound} left
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  data-testid="button-play-keno"
                  onClick={handlePlace}
                  disabled={!canPlace}
                  className="w-full rounded-xl py-3.5 text-sm font-black uppercase tracking-wider shadow-lg transition disabled:cursor-not-allowed disabled:opacity-35 bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#10221c] hover:from-emerald-400 hover:to-cyan-300 shadow-emerald-500/20"
                >
                  {animating
                    ? <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    : ticketsThisRound >= MAX_TICKETS_PER_ROUND
                    ? <span className="flex items-center justify-center gap-2"><Check className="h-4 w-4" /> Max tickets reached — waiting for draw</span>
                    : currentPicks.length > 0
                    ? `Place Bet · ${activeBet.toFixed(2)} USDT${ticketsThisRound > 0 ? ` (Ticket ${ticketsThisRound + 1})` : ""}`
                    : "Select numbers to place a bet"
                  }
                </button>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-500">
                  <span>{settings ? `${settings.minBet}–${settings.maxBet} USDT per ticket · up to ${MAX_TICKETS_PER_ROUND} tickets` : `Up to ${MAX_TICKETS_PER_ROUND} tickets per round`}</span>
                  <span>Balance {balance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </main>

          <aside className="hidden rounded-xl border border-white/10 bg-[#1b2324] lg:block">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
                <button type="button" data-testid="button-results" onClick={() => setRightTab("results")} className={`flex items-center gap-1 pb-2 transition-colors ${rightTab === "results" ? "border-b-2 border-emerald-400 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}><Check className="h-3 w-3" /> Results</button>
                <button type="button" data-testid="button-statistics" onClick={() => { setRightTab("stats"); loadStats(); }} className={`flex items-center gap-1 pb-2 transition-colors ${rightTab === "stats" ? "border-b-2 border-emerald-400 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}><BarChart3 className="h-3 w-3" /> Stats</button>
                <button type="button" data-testid="button-leaders" onClick={() => { setRightTab("leaders"); loadLeaders(); }} className={`flex items-center gap-1 pb-2 transition-colors ${rightTab === "leaders" ? "border-b-2 border-emerald-400 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}><Crown className="h-3 w-3" /> Leaders</button>
              </div>
              {rightTab === "results" && (
                <div className="mt-4 grid grid-cols-[1fr_auto] text-[10px] text-slate-500">
                  <span>Draw ID</span><span>Combination</span>
                </div>
              )}
              {rightTab === "stats" && kenoStats && (
                <p className="mt-3 text-[10px] text-slate-500">Based on last {kenoStats.totalRounds} draws · hot = drawn most often</p>
              )}
              {rightTab === "leaders" && (
                <p className="mt-3 text-[10px] text-slate-500">Top 10 players by net profit (real mode)</p>
              )}
            </div>
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-2">

              {/* ── Results tab ── */}
              {rightTab === "results" && (
                <>
                  {globalRounds.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">Results will show here.</p>}
                  {globalRounds.map((round, idx) => (
                    <div key={idx} data-testid={`row-keno-result-${idx}`} className="mb-1 rounded-lg bg-[#273335] p-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1 font-semibold text-emerald-300"><Check className="h-3 w-3" /> Draw #{round.roundId}</span>
                        <span className="text-slate-500">{new Date(round.drawnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-5 gap-1">
                        {round.drawnNumbers.slice(0, 10).map(number => (
                          <span key={number} className="rounded bg-[#344144] py-0.5 text-center text-[9px] font-bold text-slate-400">{number}</span>
                        ))}
                      </div>
                      <div className="mt-1 text-right text-[10px] text-slate-500">{round.drawnNumbers.length} numbers drawn</div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Stats tab — number frequency heatmap 1–80 ── */}
              {rightTab === "stats" && (
                <>
                  {!kenoStats && <p className="px-3 py-8 text-center text-xs text-slate-500">Loading stats…</p>}
                  {kenoStats && (() => {
                    const vals = Object.values(kenoStats.frequency);
                    const maxFreq = Math.max(...vals, 1);
                    return (
                      <div className="p-1">
                        <div className="grid grid-cols-10 gap-0.5">
                          {Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
                            const freq = kenoStats.frequency[n] ?? 0;
                            const pct  = freq / maxFreq;
                            const bg   = pct > 0.75 ? "bg-red-500 text-white"
                                       : pct > 0.5  ? "bg-orange-400 text-white"
                                       : pct > 0.25 ? "bg-yellow-400 text-gray-900"
                                       : freq > 0   ? "bg-slate-600 text-slate-300"
                                       :              "bg-[#1b2324] text-slate-600";
                            return (
                              <div key={n} title={`#${n}: drawn ${freq}×`} className={`flex aspect-square items-center justify-center rounded text-[8px] font-bold ${bg}`}>
                                {n}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500">
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Hot</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-orange-400" /> Warm</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-yellow-400" /> Mild</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-slate-600" /> Cold</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ── Leaders tab ── */}
              {rightTab === "leaders" && (
                <>
                  {kenoLeaders.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">No real-money games played yet.</p>}
                  {kenoLeaders.length > 0 && (
                    <div className="space-y-1 p-1">
                      {kenoLeaders.map((leader, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg bg-[#273335] px-3 py-2">
                          <span className={`w-5 text-center text-[10px] font-black ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-slate-500"}`}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                          </span>
                          <span className="flex-1 truncate text-[10px] font-semibold text-slate-200">{leader.username}</span>
                          <span className={`text-[10px] font-bold ${parseFloat(leader.netProfit) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {parseFloat(leader.netProfit) >= 0 ? "+" : ""}{parseFloat(leader.netProfit).toFixed(2)} USDT
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          </aside>
        </div>
      </div>

      {/* Overlays */}
      {batchResult && (
        <ResultOverlay
          drawn={batchResult.drawn}
          tickets={batchResult.tickets}
          totalPayout={batchResult.totalPayout}
          updatedBalance={batchResult.updatedBalance}
          mode={batchResult.mode}
          onClose={() => { setBatchResult(null); }}
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

      {showPaytable && (
        <PaytableSheet
          paytable={paytable}
          picksCount={currentPicks.length}
          onClose={() => setShowPaytable(false)}
        />
      )}
      {showFairness && (
        <FairnessSheet
          roundState={roundState}
          drawn={completedRoundResult?.drawn ?? revealedNums}
          onClose={() => setShowFairness(false)}
        />
      )}
    </AppLayout>
  );
}
