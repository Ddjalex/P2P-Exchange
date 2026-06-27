import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminDelete } from "@/lib/admin-api";
import { Search } from "lucide-react";

export default function AdminAdsPage() {
  const [ads, setAds] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (type !== "all") params.set("type", type);
      const data = await adminGet<any>(`/ads?${params}`);
      setAds(data.ads);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status, type]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const suspend = async (id: number) => { await adminPut(`/ads/${id}/suspend`); load(); };
  const reactivate = async (id: number) => { await adminPut(`/ads/${id}/reactivate`); load(); };
  const remove = async (id: number) => { if (!confirm("Delete this ad?")) return; await adminDelete(`/ads/${id}`); load(); };

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminGuard>
      <AdminLayout title="Ads Management">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by trader name..." className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary" />
          </div>
          <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="all">All Types</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Trader</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Limit (ETB)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
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
                ) : ads.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No ads found</td></tr>
                ) : ads.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{a.id}</td>
                    <td className="px-4 py-3 font-medium">{a.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.type === 'buy' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{a.type.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{parseFloat(a.price).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">{parseFloat(a.availableAmount).toFixed(2)} USDT</td>
                    <td className="px-4 py-3 text-xs">{parseFloat(a.minLimit).toLocaleString()} – {parseFloat(a.maxLimit).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                          a.status === 'online' ? 'bg-success/20 text-success' :
                          (a.status === 'offline' && a.pause_reason) ? 'bg-warning/20 text-warning' :
                          a.status === 'offline' ? 'bg-muted text-muted-foreground' :
                          'bg-warning/20 text-warning'
                        }`}>
                          {a.status === 'offline' && a.pause_reason ? 'paused' : a.status}
                        </span>
                        {a.pause_reason && (
                          <span className="text-[10px] text-warning/70 max-w-[180px] leading-tight">{a.pause_reason}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        {a.status === 'online' ? (
                          <button onClick={() => suspend(a.id)} className="text-xs text-destructive hover:underline">Suspend</button>
                        ) : (
                          <button onClick={() => reactivate(a.id)} className={`text-xs hover:underline ${a.pause_reason ? 'text-warning font-semibold' : 'text-success'}`}>
                            {a.pause_reason ? '✅ Reactivate' : 'Reactivate'}
                          </button>
                        )}
                        <button onClick={() => remove(a.id)} className="text-xs text-destructive hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">Showing {ads.length} of {total} ads</span>
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
