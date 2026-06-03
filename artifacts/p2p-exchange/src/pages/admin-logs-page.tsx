import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";

const ACTION_COLORS: Record<string, string> = {
  suspend_user: "text-destructive", unsuspend_user: "text-success",
  delete_user: "text-destructive", manual_verify_user: "text-success",
  grant_merchant: "text-warning", revoke_merchant: "text-muted-foreground",
  kyc_verified: "text-success", kyc_rejected: "text-destructive",
  force_complete_order: "text-success", force_cancel_order: "text-destructive",
  resolve_dispute: "text-primary", approve_withdrawal: "text-success",
  reject_withdrawal: "text-destructive", send_notification: "text-primary",
  update_settings: "text-warning", update_fees: "text-warning",
  suspend_ad: "text-destructive", reactivate_ad: "text-success", delete_ad: "text-destructive",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminGet<any>(`/logs?page=${page}`).then(d => { setLogs(d.logs); setTotal(d.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <AdminGuard>
      <AdminLayout title="Audit Logs">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Admin Audit Trail ({total} total)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-pulse w-24" /></td>)}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No audit logs yet</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-mono">{log.adminEmail}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium font-mono ${ACTION_COLORS[log.action] ?? 'text-foreground'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.targetType && log.targetId ? `${log.targetType} #${log.targetId}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
