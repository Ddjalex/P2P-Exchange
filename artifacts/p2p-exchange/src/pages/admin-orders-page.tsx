import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { Link } from "wouter";
import { Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-warning/20 text-warning",
  paid: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success",
  cancelled: "bg-muted text-muted-foreground",
  appeal: "bg-destructive/20 text-destructive",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      const data = await adminGet<any>(`/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminGuard>
      <AdminLayout title="Orders & Trades">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Order ID or username..." className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary" />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="appeal">Appeal</option>
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">USDT</th>
                  <th className="px-4 py-3">ETB</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
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
                ) : orders.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No orders found</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">#{o.id}</td>
                    <td className="px-4 py-3 text-sm">{o.buyerUsername}</td>
                    <td className="px-4 py-3 text-sm">{o.sellerUsername}</td>
                    <td className="px-4 py-3 font-mono text-sm">{parseFloat(o.amountUsdt).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-sm">{parseFloat(o.amountEtb).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="text-xs text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">{total} orders total</span>
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
