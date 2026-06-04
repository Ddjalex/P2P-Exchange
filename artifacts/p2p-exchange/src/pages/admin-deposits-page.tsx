import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { Link } from "wouter";
import { CheckCircle, XCircle, ExternalLink, RefreshCw, Clock, User, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/20 text-warning border border-warning/30",
  approved: "bg-success/20 text-success border border-success/30",
  rejected: "bg-destructive/20 text-destructive border border-destructive/30",
};

const SOURCE_LABELS: Record<string, string> = {
  user_report: "User Reported",
  monitor_failure: "Auto-detect Failed",
};

function RejectModal({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-bold text-lg mb-3">Reject Deposit</h3>
        <p className="text-sm text-muted-foreground mb-3">Provide a reason for rejection (optional but recommended):</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Txid not found, wrong network, duplicate..."
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-20 outline-none focus:border-primary mb-4"
        />
        <div className="flex space-x-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={() => onConfirm(note)} className="flex-1 py-2.5 bg-destructive text-white rounded-lg text-sm font-bold">Reject</button>
        </div>
      </div>
    </div>
  );
}

function VerificationRow({ v, onRefresh }: { v: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const { user, wallet } = v;
  const dep = v.v;

  const approve = async () => {
    if (!confirm(`Approve and credit ${dep.amount ?? "?"} USDT to ${user?.username}?`)) return;
    setLoading(true);
    try {
      await adminPost(`/deposits/verifications/${dep.id}/approve`, {});
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reject = async (note: string) => {
    setShowReject(false);
    setLoading(true);
    try {
      await adminPost(`/deposits/verifications/${dep.id}/reject`, { note });
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showReject && <RejectModal onConfirm={reject} onCancel={() => setShowReject(false)} />}
      <div className={`bg-card border rounded-xl overflow-hidden transition-all ${dep.status === "pending" ? "border-warning/30" : "border-border"}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {user?.username?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/users/${dep.userId}`} className="font-semibold hover:text-primary transition-colors">
                    {user?.username ?? `User #${dep.userId}`}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[dep.status]}`}>
                    {dep.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {SOURCE_LABELS[dep.source] ?? dep.source}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {user?.email} {user?.phone && `· ${user.phone}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  User ID: <span className="font-mono">{dep.userId}</span>
                  {wallet?.availableBalance && (
                    <span className="ml-2">· Balance: <span className="font-mono text-foreground">{parseFloat(wallet.availableBalance).toFixed(2)} USDT</span></span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="font-mono font-bold text-lg text-primary">
                {dep.amount ? `${parseFloat(dep.amount).toFixed(2)} USDT` : "Unknown"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(dep.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <a
              href={`https://tronscan.org/#/transaction/${dep.txid}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline font-mono"
            >
              <ExternalLink className="w-3 h-3" />
              {dep.txid.slice(0, 20)}...{dep.txid.slice(-8)}
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Less" : "Details"}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 bg-secondary rounded-lg p-3 space-y-1.5 text-xs font-mono">
              {dep.fromAddress && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">From:</span>
                  <span className="break-all">{dep.fromAddress}</span>
                </div>
              )}
              {dep.toAddress && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">To (deposit):</span>
                  <span className="break-all">{dep.toAddress}</span>
                </div>
              )}
              {wallet?.depositAddress && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">User addr:</span>
                  <span className={`break-all ${dep.toAddress?.toLowerCase() === wallet.depositAddress.toLowerCase() ? "text-success" : "text-warning"}`}>
                    {wallet.depositAddress}
                    {dep.toAddress?.toLowerCase() === wallet.depositAddress.toLowerCase() ? " ✓" : " ⚠ mismatch"}
                  </span>
                </div>
              )}
              {dep.adminNote && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">Note:</span>
                  <span className="text-foreground">{dep.adminNote}</span>
                </div>
              )}
              {dep.reviewedBy && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">Reviewed by:</span>
                  <span>{dep.reviewedBy} · {new Date(dep.reviewedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {dep.status === "pending" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={approve}
                disabled={loading || !dep.amount || parseFloat(dep.amount) <= 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-semibold hover:bg-success/20 disabled:opacity-40 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? "Processing..." : `Approve & Credit${dep.amount ? ` ${parseFloat(dep.amount).toFixed(2)} USDT` : ""}`}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-semibold hover:bg-destructive/20 disabled:opacity-40 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminDepositsPage() {
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = (p = page, s = statusFilter) => {
    setLoading(true);
    adminGet<any>(`/deposits/verifications?status=${s}&page=${p}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, statusFilter); setPage(1); }, [statusFilter]);

  const pending = data?.verifications?.filter((v: any) => v.v.status === "pending").length ?? 0;

  return (
    <AdminGuard>
      <AdminLayout title="Deposit Verifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">
                Review deposit reports from users and auto-detect failures.
              </p>
            </div>
            <button onClick={() => load(page, statusFilter)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === f.value ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
              >
                {f.label}
                {f.value === "pending" && data?.total > 0 && statusFilter === "pending" && (
                  <span className="ml-1.5 bg-warning text-black rounded-full px-1.5 py-0.5 text-xs font-bold">{data.total}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : !data?.verifications?.length ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {statusFilter === "pending" ? "No pending deposit verifications" : "No records found"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.verifications.map((v: any) => (
                <VerificationRow key={v.v.id} v={v} onRefresh={() => load(page, statusFilter)} />
              ))}
            </div>
          )}

          {data && data.total > 20 && (
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-secondary transition-colors"
              >
                Previous
              </button>
              <span className="py-2 text-sm text-muted-foreground">Page {page}</span>
              <button
                onClick={() => { const p = page + 1; setPage(p); load(p); }}
                disabled={data.verifications.length < 20}
                className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-secondary transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
