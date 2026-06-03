import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";

export default function AdminWalletPage() {
  const [overview, setOverview] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("withdraw");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { loadTxs(); }, [page, typeFilter, statusFilter]);

  const approve = async (id: number) => { await adminPut(`/wallet/transactions/${id}/approve`); loadTxs(); loadOverview(); };
  const reject = async (id: number) => { await adminPut(`/wallet/transactions/${id}/reject`); loadTxs(); loadOverview(); };

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminGuard>
      <AdminLayout title="Wallet & Transactions">
        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
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
                    <td className="px-4 py-3">
                      {tx.status === 'pending' && tx.type === 'withdraw' && (
                        <div className="flex space-x-2">
                          <button onClick={() => approve(tx.id)} className="text-xs text-success hover:underline">Approve</button>
                          <button onClick={() => reject(tx.id)} className="text-xs text-destructive hover:underline">Reject</button>
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
