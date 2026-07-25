import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminFetch } from "@/lib/admin-api";
import { Gamepad2, Users, TrendingUp, DollarSign, Settings, RefreshCw, ChevronDown, ChevronUp, Save, AlertTriangle, CheckCircle, BarChart2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KenoBotStats {
  realRounds: number;
  demoRounds: number;
  allTime: { total_wagered: string; total_paid_out: string; house_profit: string };
  today: { total_wagered: string; total_paid_out: string; house_profit: string };
  totalTopups: string;
  totalWithdrawals: string;
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

function OverviewTab({ stats }: { stats: KenoBotStats | null }) {
  if (!stats) return <div className="text-center py-8 text-muted-foreground text-sm">Loading stats…</div>;

  const allTime = stats.allTime ?? {};
  const today = stats.today ?? {};

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">All-Time (Real Money)</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Rounds" value={stats.realRounds.toLocaleString()} sub={`+ ${stats.demoRounds.toLocaleString()} demo`} />
        <StatCard label="Total Wagered" value={`$${parseFloat(allTime.total_wagered ?? "0").toFixed(2)}`} />
        <StatCard label="Total Paid Out" value={`$${parseFloat(allTime.total_paid_out ?? "0").toFixed(2)}`} />
        <StatCard label="House Profit" value={`$${parseFloat(allTime.house_profit ?? "0").toFixed(2)}`} color="text-green-400" />
        <StatCard label="Total Topped Up" value={`$${parseFloat(stats.totalTopups ?? "0").toFixed(2)}`} />
        <StatCard label="Total Withdrawn" value={`$${parseFloat(stats.totalWithdrawals ?? "0").toFixed(2)}`} />
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold pt-2">Today</p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Wagered" value={`$${parseFloat(today.total_wagered ?? "0").toFixed(2)}`} />
        <StatCard label="Paid Out" value={`$${parseFloat(today.total_paid_out ?? "0").toFixed(2)}`} />
        <StatCard label="Profit" value={`$${parseFloat(today.house_profit ?? "0").toFixed(2)}`} color="text-green-400" />
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

function PaytableTab() {
  const [paytable, setPaytable] = useState<PaytableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editedPick, setEditedPick] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    adminGet<PaytableEntry[]>("/games/keno/paytable")
      .then(data => {
        setPaytable(data);
        const d: Record<string, string> = {};
        for (const row of data) d[`${row.picks}_${row.hits}`] = row.multiplier;
        setDrafts(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleChange(picks: number, hits: number, val: string) {
    setDrafts(prev => ({ ...prev, [`${picks}_${hits}`]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const entries = paytable.map(r => ({
      picks: r.picks,
      hits: r.hits,
      multiplier: drafts[`${r.picks}_${r.hits}`] ?? r.multiplier,
    }));
    try {
      const res = await adminFetch("/games/keno/paytable", {
        method: "PUT",
        body: JSON.stringify(entries),
      });
      if (res.ok) {
        setSaved(true);
        // Update local paytable for live RTP recalculation
        setPaytable(prev => prev.map(r => ({
          ...r,
          multiplier: drafts[`${r.picks}_${r.hits}`] ?? r.multiplier,
        })));
      }
    } finally {
      setSaving(false);
    }
  }

  // Build a live paytable from drafts for RTP calculation
  const livePt: PaytableEntry[] = paytable.map(r => ({
    ...r,
    multiplier: drafts[`${r.picks}_${r.hits}`] ?? r.multiplier,
  }));

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>;

  const pickRows = paytable.filter(r => r.picks === editedPick);
  const rtp = calcRtp(editedPick, livePt);
  const rtpColor = rtp >= 0.75 && rtp <= 0.95 ? "text-green-400" : "text-amber-400";

  return (
    <div className="space-y-4">
      {/* Pick selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const pr = calcRtp(n, livePt);
          return (
            <button
              key={n}
              onClick={() => setEditedPick(n)}
              className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 border text-xs transition-all ${
                editedPick === n
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "border-border text-muted-foreground hover:border-purple-500/50"
              }`}
            >
              <span className="font-semibold">Pick {n}</span>
              <span className={`text-[9px] mt-0.5 ${editedPick === n ? "text-purple-200" : pr < 0.70 || pr > 0.95 ? "text-amber-400" : "text-green-400"}`}>
                {(pr * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* RTP indicator */}
      <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${rtp < 0.70 || rtp > 0.95 ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/30 bg-green-500/5"}`}>
        <div className="flex items-center gap-2">
          <BarChart2 className={`w-4 h-4 ${rtpColor}`} />
          <span className="text-sm text-muted-foreground">Live RTP for Pick {editedPick}</span>
        </div>
        <span className={`text-sm font-bold ${rtpColor}`}>{(rtp * 100).toFixed(2)}%</span>
      </div>

      {rtp < 0.50 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">RTP below 50% — multipliers may be too low. Target 75–90% for a balanced game.</p>
        </div>
      )}

      {/* Multiplier rows */}
      <div className="space-y-2">
        {pickRows.map(r => {
          const key = `${r.picks}_${r.hits}`;
          const prob = hypergeometricP(r.picks, r.hits);
          return (
            <div key={key} className="rounded-xl bg-secondary/50 border border-border px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold">{r.hits} hits</span>
                  <span className="text-xs text-muted-foreground ml-2">P = {(prob * 100).toFixed(4)}%</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  EV: {(prob * parseFloat(drafts[key] ?? "0")).toFixed(4)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drafts[key] ?? "0"}
                  onChange={e => handleChange(r.picks, r.hits, e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
                <span className="text-sm text-muted-foreground">×</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Paytable</>}
      </button>
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
    { id: "paytable", label: "Paytable", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Keno Games</h1>
              <p className="text-xs text-muted-foreground">Manage game settings, paytable, and player activity</p>
            </div>
          </div>

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
          {tab === "overview" && <OverviewTab stats={stats} />}
          {tab === "players" && <PlayersTab />}
          {tab === "paytable" && <PaytableTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
