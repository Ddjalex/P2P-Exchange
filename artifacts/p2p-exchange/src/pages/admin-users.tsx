import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminDelete } from "@/lib/admin-api";
import { Link } from "wouter";
import { Search, CheckCircle, XCircle, ShieldCheck } from "lucide-react";

const KYC_COLORS: Record<string, string> = {
  verified: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  rejected: "bg-destructive/20 text-destructive",
  more_info_required: "bg-orange/20 text-orange",
  none: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (kycFilter !== "all") params.set("kycStatus", kycFilter);
      const data = await adminGet<any>(`/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, kycFilter]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const suspend = async (id: number, isSuspended: boolean) => {
    const reason = isSuspended ? undefined : prompt("Suspension reason:");
    if (!isSuspended && reason === null) return;
    await adminPut(`/users/${id}/${isSuspended ? "unsuspend" : "suspend"}`, { reason });
    load();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminGuard>
      <AdminLayout title="Users Management">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by username or email..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>
          <select value={kycFilter} onChange={e => { setKycFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:border-primary">
            <option value="all">All KYC</option>
            <option value="none">None</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="more_info_required">More Info</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">KYC</th>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-pulse w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{u.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary transition-colors">{u.username}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KYC_COLORS[u.kycStatus] ?? ''}`}>
                        {u.kycStatus?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isMerchant ? <CheckCircle className="w-4 h-4 text-success" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {u.isSuspended
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">Suspended</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline">View</Link>
                        <button onClick={() => suspend(u.id, u.isSuspended)} className={`text-xs hover:underline ${u.isSuspended ? 'text-success' : 'text-destructive'}`}>
                          {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">Showing {users.length} of {total} users</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary transition-colors">Prev</button>
              <span className="px-3 py-1.5 text-muted-foreground">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary transition-colors">Next</button>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
