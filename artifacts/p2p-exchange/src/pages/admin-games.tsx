import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminFetch, adminPost } from "@/lib/admin-api";
import { Gamepad2, Users, TrendingUp, DollarSign, Settings, RefreshCw, ChevronDown, ChevronUp, Save, AlertTriangle, CheckCircle, BarChart2, ArrowDownToLine } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KenoBotStats {
  realRounds: number;
  demoRounds: number;
  allTime: { total_wagered: string; total_paid_out: string; house_profit: string };
  today: { total_wagered: string; total_paid_out: string; house_profit: string };
  totalTopups: string;
  totalWithdrawals: string;
  mergedProfit: string;
  platformCollected: string;
}

interface KenoPlayer {
  user_id: number;
  username: string;
  real_balance: string;
  demo_balance: string;
  real_rounds: string;
  demo_rounds: string;
  total_wagered: string;
  total_won: string;
  house_profit: string;
}

interface PaytableEntry {
  id: number;
  picks: number;
  hits: number;
  multiplier: string;
}

interface KenoSettings {
  game_enabled: string;
  min_bet: string;
  max_bet: string;
  min_topup: string;
  max_topup: string;
}

// ─── Hypergeometric helpers (mirror keno.tsx) ─────────────────────────────────

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
  return rows.reduce((acc, r) => acc + hypergeometricP(r.picks, r.hits) * parseFloat(r.multiplier), 0);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-foreground" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, onRefresh }: { stats: KenoBotStats | null; onRefresh: () => void }) {
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);

  async function handleMerge() {
    setMerging(true);
    setMergeMsg(null);
    try {
      const result = await adminPost<{ success: boolean; merged: number; message?: string }>("/games/keno/merge-profit");
      if (result.merged > 0) {
        setMergeMsg(`✓ Merged $${result.merged.toFixed(2)} to platform wallet`);
        onRefresh();
      } else {
        setMergeMsg(result.message ?? "No new profit to merge");
      }
    } catch (e: any) {
      setMergeMsg(`Error: ${e.message}`);
    } finally {
      setMerging(false);
    }
  }

  if (!stats) return <div className="text-center py-8 text-muted-foreground text-sm">Loading stats…</div>;

  const allTime = stats.allTime ?? {};
  const today = stats.today ?? {};
  const houseProfit = parseFloat(allTime.house_profit ?? "0");
  const mergedProfit = parseFloat(stats.mergedProfit ?? "0");
  const unmerged = Math.max(0, houseProfit - mergedProfit);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">All-Time (Real Money)</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Rounds" value={stats.realRounds.toLocaleString()} sub={`+ ${stats.demoRounds.toLocaleString()} demo`} />
        <StatCard label="Total Wagered" value={`$${parseFloat(allTime.total_wagered ?? "0").toFixed(2)}`} />
        <StatCard label="Total Paid Out" value={`$${parseFloat(allTime.total_paid_out ?? "0").toFixed(2)}`} />
        <StatCard label="House Profit" value={`$${houseProfit.toFixed(2)}`} color="text-green-400" />
        <StatCard label="Total Topped Up" value={`$${parseFloat(stats.totalTopups ?? "0").toFixed(2)}`} />
        <StatCard label="Total Withdrawn" value={`$${parseFloat(stats.totalWithdrawals ?? "0").toFixed(2)}`} />
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold pt-2">Today</p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Wagered" value={`$${parseFloat(today.total_wagered ?? "0").toFixed(2)}`} />
        <StatCard label="Paid Out" value={`$${parseFloat(today.total_paid_out ?? "0").toFixed(2)}`} />
        <StatCard label="Profit" value={`$${parseFloat(today.house_profit ?? "0").toFixed(2)}`} color="text-green-400" />
      </div>

      {/* ── Merge Profit ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Merge Profit</p>
            <p className="text-xs text-muted-foreground">Transfer house profit to platform wallet</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className={`text-lg font-bold ${unmerged > 0 ? "text-green-400" : "text-muted-foreground"}`}>
              ${unmerged.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
          <span>Total collected in platform wallet</span>
          <span className="font-semibold text-foreground">${parseFloat(stats.platformCollected ?? "0").toFixed(2)}</span>
        </div>
        {mergeMsg && (
          <p className={`text-xs text-center ${mergeMsg.startsWith("✓") ? "text-green-400" : "text-muted-foreground"}`}>
            {mergeMsg}
          </p>
        )}
        <button
          onClick={handleMerge}
          disabled={merging || unmerged <= 0}
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {merging
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Merging…</>
            : <><ArrowDownToLine className="w-4 h-4" /> Merge Profit to Platform</>}
        </button>
      </div>
    </div>
  );
}

// ─── Players tab ──────────────────────────────────────────────────────────────

function PlayersTab() {
  const [players, setPlayers] = useState<KenoPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KenoPlayer | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminGet<KenoPlayer[]>("/games/keno/players")
      .then(setPlayers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function loadDetail(p: KenoPlayer) {
    setSelected(p);
    setDetailLoading(true);
    try {
      const data = await adminGet<any>(`/games/keno/player/${p.user_id}`);
      setDetail(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>;

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelected(null); setDetail(null); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Back to players
        </button>

        <div className="rounded-xl bg-card border border-border p-4">
          <p className="font-semibold">{selected.username}</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <StatCard label="Real Balance" value={`$${parseFloat(selected.real_balance).toFixed(2)}`} />
            <StatCard label="Demo Balance" value={parseFloat(selected.demo_balance).toFixed(0)} />
            <StatCard label="Real Rounds" value={selected.real_rounds} />
            <StatCard label="Demo Rounds" value={selected.demo_rounds} />
            <StatCard label="Total Wagered" value={`$${parseFloat(selected.total_wagered).toFixed(2)}`} />
            <StatCard label="House Profit" value={`$${parseFloat(selected.house_profit).toFixed(2)}`} color="text-green-400" />
          </div>
        </div>

        {detailLoading && <div className="text-center py-4 text-muted-foreground text-sm">Loading rounds…</div>}

        {detail?.rounds?.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Recent Rounds</p>
            <div className="space-y-2">
              {detail.rounds.slice(0, 20).map((r: any) => (
                <div key={r.id} className="flex justify-between items-center rounded-xl bg-secondary/50 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold">{r.hit_count}/{Array.isArray(r.picks) ? r.picks.length : "?"} hits · {parseFloat(r.multiplier).toFixed(2)}× <span className="text-muted-foreground">[{r.mode}]</span></p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">Bet {parseFloat(r.bet_amount).toFixed(2)}</p>
                    <p className={`text-xs ${parseFloat(r.payout_amount) > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {parseFloat(r.payout_amount) > 0 ? `+${parseFloat(r.payout_amount).toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail?.transactions?.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Transactions</p>
            <div className="space-y-2">
              {detail.transactions.filter((t: any) => ["topup", "withdraw"].includes(t.type)).map((t: any) => (
                <div key={t.id} className="flex justify-between items-center rounded-xl bg-secondary/50 px-3 py-2">
                  <p className="text-xs font-semibold capitalize">{t.type} <span className="text-muted-foreground">[{t.mode}]</span></p>
                  <p className={`text-xs font-semibold ${t.type === "topup" ? "text-green-400" : "text-amber-400"}`}>
                    {t.type === "topup" ? "+" : "−"}{parseFloat(t.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No players yet</p>}
      {players.map(p => (
        <button key={p.user_id} onClick={() => loadDetail(p)} className="w-full text-left rounded-xl bg-card border border-border px-4 py-3 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{p.username}</p>
              <p className="text-xs text-muted-foreground">
                {p.real_rounds} real · {p.demo_rounds} demo · balance ${parseFloat(p.real_balance).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-400">+${parseFloat(p.house_profit).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">house profit</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Paytable tab ─────────────────────────────────────────────────────────────

interface RoundPoolPreview {
  round_id: number;
  phase: string;
  confirmed_entries: number;
  house_margin_percent: number;
  gross_pool: number;
  owner_profit_allocation: number;
  prize_budget: number;
}
interface RoundHistoryEntry {
  round_id: number;
  confirmed_entries: number | null;
  house_margin_percent: number | null;
  gross_pool: number | null;
  owner_profit_allocation: number | null;
  prize_budget: number | null;
  total_prizes_paid: number | null;
  unclaimed_amount: number | null;
  created_at: string;
}
function PoolFinancialsTab() {
  const [marginPercent, setMarginPercent] = useState("20");
  const [savedMargin, setSavedMargin] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoundPoolPreview | null>(null);
  const [history, setHistory] = useState<RoundHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    try {
      const [marginRes, previewRes, historyRes] = await Promise.all([
        adminGet<{ house_margin_percent: number }>("/games/keno/house-margin"),
        adminGet<RoundPoolPreview>("/games/keno/current-round-pool"),
        adminGet<RoundHistoryEntry[]>("/games/keno/round-history?limit=20"),
      ]);
      setSavedMargin(marginRes.house_margin_percent);
      setMarginPercent(String(marginRes.house_margin_percent));
      setPreview(previewRes);
      setHistory(historyRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      adminGet<RoundPoolPreview>("/games/keno/current-round-pool").then(setPreview).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const draftMarginNum = parseFloat(marginPercent);
  const livePreview = preview && !isNaN(draftMarginNum) ? {
    grossPool: preview.gross_pool,
    ownerProfit: parseFloat((preview.gross_pool * (draftMarginNum / 100)).toFixed(2)),
    prizeBudget: parseFloat((preview.gross_pool * (1 - draftMarginNum / 100)).toFixed(2)),
  } : null;

  async function applyMargin() {
    setApplying(true);
    setApplied(false);
    setError(null);
    try {
      const num = parseFloat(marginPercent);
      if (isNaN(num) || num < 0 || num > 100) {
        setError("Margin must be a number between 0 and 100");
        return;
      }
      const res = await adminFetch("/games/keno/house-margin", {
        method: "PUT",
        body: JSON.stringify({ house_margin_percent: num }),
      });
      if (res.ok) {
        setSavedMargin(num);
        setApplied(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to apply margin");
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* House Margin control */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold">House Profit Margin</span>
        </div>
        <p className="text-xs text-muted-foreground">
          All confirmed bets in a round form a shared pool. This margin is the owner's share; the rest is split among winners. Changing this only affects future rounds — the current round already locked its margin. The draw itself always stays 100% random.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={marginPercent}
            onChange={e => { setMarginPercent(e.target.value); setApplied(false); }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
          />
          <span className="text-sm text-muted-foreground">% margin</span>
          <button
            onClick={applyMargin}
            disabled={applying}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
          >
            {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : applied ? <CheckCircle className="w-4 h-4" /> : null}
            {applying ? "Applying…" : applied ? "Applied!" : "Apply"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {savedMargin !== null && (
          <p className="text-xs text-muted-foreground">Currently active for new rounds: <span className="font-semibold text-foreground">{savedMargin}%</span></p>
        )}
      </div>

      {livePreview && preview && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Current Round #{preview.round_id} ({preview.phase})</span>
            <span className="text-xs text-muted-foreground">{preview.confirmed_entries} confirmed entries</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Gross Pool</div>
              <div className="text-sm font-bold">{livePreview.grossPool.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Owner Profit</div>
              <div className="text-sm font-bold text-purple-400">{livePreview.ownerProfit.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prize Budget</div>
              <div className="text-sm font-bold text-green-400">{livePreview.prizeBudget.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Round Financial History</span>
        </div>
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">No completed rounds with financial data yet.</p>
        )}
        {history.map(r => (
          <div key={r.round_id} className="rounded-xl bg-secondary/50 border border-border px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Round #{r.round_id}</span>
              <span className="text-xs text-muted-foreground">{r.confirmed_entries ?? 0} entries · {r.house_margin_percent !== null ? (r.house_margin_percent + "% margin") : "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Gross Pool</span><span>{r.gross_pool !== null ? r.gross_pool.toFixed(2) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Owner Profit</span><span>{r.owner_profit_allocation !== null ? r.owner_profit_allocation.toFixed(2) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Prize Budget</span><span>{r.prize_budget !== null ? r.prize_budget.toFixed(2) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Prizes Paid</span><span>{r.total_prizes_paid !== null ? r.total_prizes_paid.toFixed(2) : "—"}</span></div>
              <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Unclaimed</span><span>{r.unclaimed_amount !== null ? r.unclaimed_amount.toFixed(2) : "—"}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<KenoSettings>({
    game_enabled: "true",
    min_bet: "0.10",
    max_bet: "100.00",
    min_topup: "1.00",
    max_topup: "1000.00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminGet<KenoSettings>("/games/keno/settings")
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof KenoSettings, val: string) {
    setSettings(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await adminFetch("/games/keno/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>;

  const Field = ({ label, k, type = "number" }: { label: string; k: keyof KenoSettings; type?: string }) => (
    <div>
      <label className="text-xs text-muted-foreground block mb-1.5">{label}</label>
      <input
        type={type}
        value={settings[k]}
        onChange={e => update(k, e.target.value)}
        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Game toggle */}
      <div className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Game Enabled</p>
          <p className="text-xs text-muted-foreground">Disable to prevent new rounds</p>
        </div>
        <button
          onClick={() => update("game_enabled", settings.game_enabled === "true" ? "false" : "true")}
          className={`w-12 h-6 rounded-full transition-colors relative ${settings.game_enabled === "true" ? "bg-purple-600" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings.game_enabled === "true" ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Bet Limits</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min Bet (USDT)" k="min_bet" />
          <Field label="Max Bet (USDT)" k="max_bet" />
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Top-Up Limits</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min Top-Up (USDT)" k="min_topup" />
          <Field label="Max Top-Up (USDT)" k="max_topup" />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
      </button>
    </div>
  );
}

// ─── Main admin page ──────────────────────────────────────────────────────────

type Tab = "overview" | "players" | "paytable" | "settings";

export default function AdminGamesPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<KenoBotStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    adminGet<KenoBotStats>("/games/keno/stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "players", label: "Players", icon: Users },
    { id: "paytable", label: "Financials", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <AdminGuard>
      <AdminLayout title="Keno Games">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">

          {/* Tab bar */}
          <div className="flex gap-1 bg-secondary rounded-xl p-1">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.id ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {tab === "overview" && <OverviewTab stats={stats} onRefresh={() => {
            setStatsLoading(true);
            adminGet<KenoBotStats>("/games/keno/stats")
              .then(setStats)
              .catch(console.error)
              .finally(() => setStatsLoading(false));
          }} />}
          {tab === "players" && <PlayersTab />}
          {tab === "paytable" && <PoolFinancialsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
