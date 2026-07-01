import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { Shield, AlertTriangle, Users, Lock, Unlock, Ban, RefreshCw, Activity, TrendingUp, Clock } from "lucide-react";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function actionBadge(action: string) {
  const colors: Record<string, string> = {
    WITHDRAWAL: "bg-orange-500/20 text-orange-400",
    INTERNAL_TRANSFER: "bg-blue-500/20 text-blue-400",
    CARD_FUND: "bg-purple-500/20 text-purple-400",
  };
  return colors[action] ?? "bg-gray-500/20 text-gray-400";
}

export default function AdminSecurityPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [limitsConfig, setLimitsConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, f, l] = await Promise.all([
        adminGet<{ alerts: any[] }>("/security/alerts"),
        adminGet<{ flaggedUsers: any[] }>("/security/flagged-users"),
        adminGet<{ usage: any[]; limits: any }>("/security/daily-limits"),
      ]);
      setAlerts(a.alerts ?? []);
      setFlagged(f.flaggedUsers ?? []);
      setLimits(l.usage ?? []);
      setLimitsConfig(l.limits ?? {});
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function freeze(userId: number) {
    const reason = prompt("Reason for freezing account:");
    if (!reason) return;
    setActing(userId);
    await adminPost(`/security/freeze/${userId}`, { reason }).catch(() => {});
    setActing(null);
    load();
  }

  async function unfreeze(userId: number) {
    setActing(userId);
    await adminPost(`/security/unfreeze/${userId}`, {}).catch(() => {});
    setActing(null);
    load();
  }

  async function ban(userId: number) {
    const reason = prompt("Reason for banning account:");
    if (!reason) return;
    setActing(userId);
    await adminPost(`/security/ban/${userId}`, { reason }).catch(() => {});
    setActing(null);
    load();
  }

  return (
    <AdminGuard>
      <AdminLayout title="Security Dashboard">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Security Dashboard</h1>
                <p className="text-xs text-muted-foreground">Real-time fraud detection and account controls</p>
              </div>
            </div>
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-primary/30 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Audit Logs (24h)</span>
              </div>
              <div className="text-2xl font-bold font-mono">{alerts.length}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Flagged Users</span>
              </div>
              <div className="text-2xl font-bold font-mono text-orange-400">{flagged.length}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Active Today</span>
              </div>
              <div className="text-2xl font-bold font-mono">{limits.length}</div>
            </div>
          </div>

          {/* Flagged users */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Users className="w-4 h-4 text-orange-400" />
              <h2 className="font-semibold text-sm">Flagged / Suspicious Users</h2>
            </div>
            {flagged.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No flagged users</div>
            ) : (
              <div className="divide-y divide-border">
                {flagged.map((u) => (
                  <div key={u.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{u.username}</span>
                          {u.isBanned && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">BANNED</span>}
                          {u.isFrozen && !u.isBanned && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">FROZEN</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {u.freezeReason && <div className="text-xs text-orange-400 mt-1">Reason: {u.freezeReason}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-primary">${parseFloat(u.availableBalance ?? "0").toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">balance</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Card funded: <span className="text-foreground">${u.cardFunded}</span></span>
                      <span>Card withdrawn: <span className={parseFloat(u.cardWithdrawn) > parseFloat(u.cardFunded) ? "text-red-400" : "text-foreground"}>${u.cardWithdrawn}</span></span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {!u.isFrozen && (
                        <button
                          onClick={() => freeze(u.id)}
                          disabled={acting === u.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                        >
                          <Lock className="w-3 h-3" /> Freeze
                        </button>
                      )}
                      {u.isFrozen && !u.isBanned && (
                        <button
                          onClick={() => unfreeze(u.id)}
                          disabled={acting === u.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        >
                          <Unlock className="w-3 h-3" /> Unfreeze
                        </button>
                      )}
                      {!u.isBanned && (
                        <button
                          onClick={() => ban(u.id)}
                          disabled={acting === u.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-3 h-3" /> Ban
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily limits usage */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-sm">Daily Limits Usage (Today)</h2>
              <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
                <span>Withdraw limit: <strong className="text-foreground">${limitsConfig.withdraw}</strong></span>
                <span>Send limit: <strong className="text-foreground">${limitsConfig.internal_send}</strong></span>
              </div>
            </div>
            {limits.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No transactions today</div>
            ) : (
              <div className="divide-y divide-border">
                {limits.map((row: any, i: number) => {
                  const wPct = Math.min(100, (parseFloat(row.withdrawals) / limitsConfig.withdraw) * 100);
                  const sPct = Math.min(100, (parseFloat(row.internal_sends) / limitsConfig.internal_send) * 100);
                  return (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{row.username}</span>
                        <span className="text-xs text-muted-foreground">{row.email}</span>
                      </div>
                      {parseFloat(row.withdrawals) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Withdrawals</span>
                            <span className={wPct >= 80 ? "text-orange-400" : ""}>${parseFloat(row.withdrawals).toFixed(2)} / ${limitsConfig.withdraw}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${wPct >= 80 ? "bg-orange-400" : "bg-primary"}`} style={{ width: `${wPct}%` }} />
                          </div>
                        </div>
                      )}
                      {parseFloat(row.internal_sends) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Internal Sends</span>
                            <span>${parseFloat(row.internal_sends).toFixed(2)} / ${limitsConfig.internal_send}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${sPct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent audit log */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Recent Audit Log (24h)</h2>
            </div>
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No audit events in the last 24 hours</div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {alerts.map((a) => (
                  <div key={a.id} className="p-3 flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono whitespace-nowrap ${actionBadge(a.action)}`}>{a.action}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground truncate">
                        User {a.userId} — {a.details ? JSON.stringify(a.details).slice(0, 80) : "—"}
                      </div>
                      {a.ipAddress && <div className="text-xs text-muted-foreground/50">IP: {a.ipAddress}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(a.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
