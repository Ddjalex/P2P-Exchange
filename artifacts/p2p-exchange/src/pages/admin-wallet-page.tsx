import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminPost } from "@/lib/admin-api";


function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function AdminWalletPage() {
  const [, navigate] = useLocation();
  const [overview, setOverview] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("withdraw");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Health panel state
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<any>(null);

  const loadOverview = () => adminGet<any>("/wallet/overview").then(setOverview).catch(() => {});
  const loadTxs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data = await adminGet<any>(`/wallet/transactions?${params}`);
      setTxs(data.transactions);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await adminGet<any>("/wallet/health");
      setHealth(data);
    } catch (e: any) {
      setHealthError(e?.message ?? "Failed to load wallet health");
    }
    setHealthLoading(false);
  };

  useEffect(() => { loadOverview(); loadHealth(); }, []);
  useEffect(() => { loadTxs(); }, [page, typeFilter, statusFilter]);

  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);

  const approve = async (id: number) => { await adminPut(`/wallet/transactions/${id}/approve`); loadTxs(); loadOverview(); };
  const reject = async (id: number) => { await adminPut(`/wallet/transactions/${id}/reject`); loadTxs(); loadOverview(); };
  const cancel = async (id: number) => {
    if (!confirm("Cancel this withdrawal and refund the user?")) return;
    await adminPut(`/wallet/transactions/${id}/cancel`);
    loadTxs();
    loadOverview();
  };

  const fixFrozen = async () => {
    setFixing(true); setFixResult(null);
    try {
      const res = await adminPost<any>("/wallet/recalculate-frozen");
      setFixResult(res);
      loadOverview();
    } catch { setFixResult({ error: "Failed" }); }
    setFixing(false);
  };

  const sweepAll = async () => {
    setSweeping(true); setSweepResult(null);
    try {
      const res = await adminPost<any>("/sweep-stuck-funds", {});
      setSweepResult(res);
      loadHealth();
    } catch (e: any) { setSweepResult({ error: e?.message ?? "Sweep failed" }); }
    setSweeping(false);
  };

  const freezeUser = async (userId: number) => {
    if (!confirm(`Freeze user ${userId}?`)) return;
    await adminPost(`/security/freeze/${userId}`, {});
    loadHealth();
  };
  const banUser = async (userId: number) => {
    if (!confirm(`Permanently ban user ${userId}? This cannot be undone.`)) return;
    await adminPost(`/security/ban/${userId}`, {});
    loadHealth();
  };

  const totalPages = Math.ceil(total / 20);

  const pendingCount = Number(overview?.pendingWithdrawals ?? 0);
  const hotBalance = parseFloat(overview?.hotWalletBalance ?? "0");
  const hotBalanceLow = pendingCount > 0 && overview?.hotWalletBalance != null && hotBalance < 50;

  const hw = health?.hotWallet;
  const audit = health?.audit;

  return (
    <AdminGuard>
      <AdminLayout title="Wallet & Transactions">

        {/* ── Wallet Health Panel ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <h3 className="font-bold text-sm">Wallet Health</h3>
              {health?.scannedAt && (
                <span className="text-xs text-muted-foreground">
                  Last scanned: {new Date(health.scannedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={loadHealth}
              disabled={healthLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
            >
              {healthLoading ? "🔄 Scanning…" : "🔄 Refresh All"}
            </button>
          </div>

          {healthError ? (
            <div className="p-5 text-xs text-destructive">{healthError}</div>
          ) : healthLoading && !health ? (
            <div className="p-5 text-xs text-muted-foreground animate-pulse">Scanning wallet health…</div>
          ) : health && (
            <div className="divide-y divide-border">

              {/* Hot Wallet Status */}
              <div className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🔑 Hot Wallet Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Address</span>
                      {hw?.address && (
                        <a
                          href={`https://bscscan.com/address/${hw.address}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >BSCScan ↗</a>
                      )}
                    </div>
                    <p className="font-mono text-xs text-foreground break-all">{hw?.address ?? "—"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">USDT Balance</span>
                      {hw?.usdtBalance != null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hw.usdtLow ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
                          {hw.usdtLow ? "⚠️ Low" : "✅ Good"}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Unknown</span>
                      )}
                    </div>
                    <p className="text-xl font-bold font-mono">{hw?.usdtBalance != null ? `$${parseFloat(hw.usdtBalance).toFixed(2)}` : "—"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">BNB Balance</span>
                      {hw?.bnbBalance != null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hw.bnbLow ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
                          {hw.bnbLow ? "⚠️ Low" : "✅ Good"}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Unknown</span>
                      )}
                    </div>
                    <p className="font-mono text-sm font-semibold">{hw?.bnbBalance != null ? `${hw.bnbBalance.toFixed(4)} BNB` : "—"}</p>
                  </div>
                </div>
              </div>

              {/* Balance Audit */}
              {audit && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📊 Balance Audit</p>
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-2 font-mono text-sm">
                    {[
                      ["Hot wallet real USDT", audit.actualHotWallet != null ? `$${audit.actualHotWallet}` : "—"],
                      ["Total platform balances", `$${audit.totalPlatform}`],
                      ["Real chain deposits", `$${audit.totalRealDeposits}`],
                      ["Total withdrawn", `$${audit.totalWithdrawn}`],
                      ["Expected hot wallet", `$${audit.expectedHotWallet}`],
                      ["Actual hot wallet", audit.actualHotWallet != null ? `$${audit.actualHotWallet}` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-muted-foreground text-xs">{label}</span>
                        <span className="text-xs font-semibold">{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 pt-2 border-t border-border">
                      <span className="text-muted-foreground text-xs">Discrepancy</span>
                      <span className={`text-xs font-bold ${audit.discrepancy != null && parseFloat(audit.discrepancy) < -5 ? "text-destructive" : "text-foreground"}`}>
                        {audit.discrepancy != null ? `$${audit.discrepancy}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stuck Deposits */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🔍 Stuck Deposits</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{health.stuckDeposits?.length ?? 0} found</span>
                    <button
                      onClick={sweepAll}
                      disabled={sweeping || !health.stuckDeposits?.length}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-90"
                    >
                      {sweeping ? "Sweeping…" : "🧹 Sweep All"}
                    </button>
                  </div>
                </div>
                {sweepResult && (
                  <div className={`mb-3 text-xs px-3 py-2 rounded-lg ${sweepResult.error ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20"}`}>
                    {sweepResult.error ? `Error: ${sweepResult.error}` : `Swept: ${sweepResult.swept}, Failed: ${sweepResult.failed}`}
                  </div>
                )}
                {!health.stuckDeposits?.length ? (
                  <div className="text-xs text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3">✅ No stuck deposits — all user addresses are clear.</div>
                ) : (
                  <div className="space-y-2">
                    {health.stuckDeposits.map((d: any) => (
                      <div key={d.address} className="flex items-center justify-between bg-warning/10 border border-warning/25 rounded-xl px-4 py-2.5">
                        <div>
                          <span className="text-xs font-medium text-foreground">User #{d.userId}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">{shortAddr(d.address)}</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-warning">${parseFloat(d.balance).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suspicious Users */}
              {health.suspiciousUsers?.length > 0 && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">⚠️ Suspicious Users (balance &gt;&gt; real deposits)</p>
                  <div className="space-y-3">
                    {health.suspiciousUsers.map((u: any) => (
                      <div key={u.userId} className="bg-destructive/5 border border-destructive/25 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-semibold text-sm text-foreground">{u.username ?? `User #${u.userId}`}</div>
                            <div className="text-xs text-muted-foreground mb-2">{u.email}</div>
                            <div className="space-y-0.5 font-mono text-xs">
                              <div className="flex gap-4"><span className="text-muted-foreground">Platform balance:</span><span className="font-bold text-foreground">${u.platformBalance}</span></div>
                              <div className="flex gap-4"><span className="text-muted-foreground">Real deposits:</span><span>${u.realDeposits}</span></div>
                              <div className="flex gap-4"><span className="text-muted-foreground">Difference:</span><span className="text-destructive font-bold">🚨 ${u.difference}</span></div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => freezeUser(u.userId)} className="px-3 py-1.5 bg-warning/20 text-warning text-xs font-semibold rounded-lg hover:bg-warning/30 border border-warning/30">🔒 Freeze</button>
                            <button onClick={() => banUser(u.userId)} className="px-3 py-1.5 bg-destructive/20 text-destructive text-xs font-semibold rounded-lg hover:bg-destructive/30 border border-destructive/30">❌ Ban</button>
                            <button onClick={() => navigate(`/admin/users/${u.userId}`)} className="px-3 py-1.5 bg-secondary text-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 border border-border">📋 View</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Total Available USDT", value: overview?.totalAvailable ?? "—" },
            { label: "Total Frozen USDT", value: overview?.totalFrozen ?? "—" },
            { label: "Total Platform USDT", value: overview?.totalUsdt ?? "—" },
            { label: "Pending Withdrawals", value: overview?.pendingWithdrawals ?? "—" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
              <div className="text-xl font-bold font-mono">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Hot Wallet Balance — always visible, highlighted when pending withdrawals exist */}
        <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
          hotBalanceLow
            ? "bg-destructive/10 border-destructive/40"
            : pendingCount > 0
              ? "bg-warning/10 border-warning/40"
              : "bg-card border-border"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 text-lg ${hotBalanceLow ? "text-destructive" : pendingCount > 0 ? "text-warning" : "text-muted-foreground"}`}>
              {hotBalanceLow ? "⚠️" : pendingCount > 0 ? "🔶" : "🔑"}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Hot Wallet Balance (BEP20 USDT)</div>
              <div className={`text-2xl font-bold font-mono ${hotBalanceLow ? "text-destructive" : pendingCount > 0 ? "text-warning" : ""}`}>
                {overview?.hotWalletBalance != null ? `${parseFloat(overview.hotWalletBalance).toFixed(2)} USDT` : "—"}
              </div>
              {overview?.hotWalletAddress && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono break-all">{overview.hotWalletAddress}</span>
                  <a href={`https://bscscan.com/address/${overview.hotWalletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">BSCScan ↗</a>
                </div>
              )}
            </div>
          </div>
          {pendingCount > 0 && (
            <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
              hotBalanceLow
                ? "bg-destructive/20 text-destructive"
                : "bg-warning/20 text-warning"
            }`}>
              {hotBalanceLow
                ? `⚠ Low balance — ${pendingCount} withdrawal${pendingCount > 1 ? "s" : ""} pending`
                : `${pendingCount} withdrawal${pendingCount > 1 ? "s" : ""} awaiting payout`}
            </div>
          )}
        </div>

        {/* Fix Frozen Balances */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={fixFrozen}
            disabled={fixing}
            className="px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm font-medium rounded-lg hover:bg-yellow-500/25 transition-colors disabled:opacity-50"
          >
            {fixing ? "Fixing…" : "🔧 Recalculate Frozen Balances"}
          </button>
          {fixResult && !fixResult.error && (
            <span className="text-xs text-success">
              {fixResult.fixed === 0 ? "All balances already correct." : `Fixed ${fixResult.fixed} wallet(s).`}
              {fixResult.results?.map((r: any) => (
                <span key={r.userId} className="ml-2">{r.username}: {r.oldFrozen} → {r.newFrozen} (+{r.released} released)</span>
              ))}
            </span>
          )}
          {fixResult?.error && <span className="text-xs text-destructive">Error: {fixResult.error}</span>}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="all">All Types</option>
            <option value="deposit">Deposits</option>
            <option value="withdraw">Withdrawals</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Network</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-pulse w-16" /></td>)}
                    </tr>
                  ))
                ) : txs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No transactions found</td></tr>
                ) : txs.map(tx => (
                  <tr
                    key={tx.id}
                    onClick={() => tx.type === 'withdraw' ? navigate(`/admin/wallet/withdrawals/${tx.id}`) : undefined}
                    className={`border-b border-border/50 transition-colors ${tx.type === 'withdraw' ? 'hover:bg-secondary/50 cursor-pointer' : 'hover:bg-secondary/30'}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">#{tx.id}</td>
                    <td className="px-4 py-3 font-medium">{tx.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tx.type === 'deposit' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{tx.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{parseFloat(tx.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">{tx.network ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'completed' ? 'bg-success/20 text-success' : tx.status === 'pending' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>{tx.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{tx.address ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {tx.status === 'pending' && tx.type === 'withdraw' && (
                        <div className="flex space-x-2">
                          <button onClick={() => approve(tx.id)} className="text-xs text-success hover:underline">Approve</button>
                          <button onClick={() => reject(tx.id)} className="text-xs text-destructive hover:underline">Reject</button>
                          <button onClick={() => cancel(tx.id)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">{total} transactions total</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40">Prev</button>
              <span className="px-3 py-1.5 text-muted-foreground">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
