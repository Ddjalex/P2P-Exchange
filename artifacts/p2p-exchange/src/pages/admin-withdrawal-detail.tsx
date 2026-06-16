import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";
import { ArrowLeft, User, Hash, Network, Wallet, Clock, CheckCircle2, XCircle, Copy } from "lucide-react";

export default function AdminWithdrawalDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = params.id;

  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<any>(`/wallet/transactions/${id}`);
      setTx(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load withdrawal");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleApprove = async () => {
    if (!confirm("Approve this withdrawal and broadcast to the blockchain?")) return;
    setApproving(true);
    setActionResult(null);
    try {
      const res = await adminPut<any>(`/wallet/transactions/${id}/approve`);
      setActionResult({ type: "success", message: `Approved! TXID: ${res.txid ?? "sent"}` });
      load();
    } catch (e: any) {
      setActionResult({ type: "error", message: e?.message ?? "Approval failed" });
    }
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    setActionResult(null);
    try {
      await adminPut(`/wallet/transactions/${id}/reject`, { reason: rejectReason || undefined });
      setActionResult({ type: "success", message: "Withdrawal rejected and funds returned to user." });
      setShowRejectForm(false);
      setRejectReason("");
      load();
    } catch (e: any) {
      setActionResult({ type: "error", message: e?.message ?? "Rejection failed" });
    }
    setRejecting(false);
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  const fee = tx ? parseFloat(tx.fee ?? "0") : 0;
  const amount = tx ? parseFloat(tx.amount ?? "0") : 0;
  const netAmount = amount - fee;

  return (
    <AdminGuard>
      <AdminLayout title="Withdrawal Detail">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/admin/wallet")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Wallet
          </button>

          {loading && (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground animate-pulse">
              Loading withdrawal…
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-destructive text-sm">
              {error}
            </div>
          )}

          {!loading && !error && tx && (
            <div className="space-y-4">
              {/* Status banner */}
              <div className={`rounded-xl px-5 py-4 border flex items-center gap-3 ${
                tx.status === "pending" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                tx.status === "completed" ? "bg-green-500/10 border-green-500/30 text-green-400" :
                "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
                {tx.status === "completed" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> :
                 tx.status === "failed" ? <XCircle className="w-5 h-5 flex-shrink-0" /> :
                 <Clock className="w-5 h-5 flex-shrink-0" />}
                <div>
                  <div className="font-semibold text-sm capitalize">{tx.status === "failed" ? "Rejected" : tx.status}</div>
                  <div className="text-xs opacity-75">Withdrawal #{tx.id}</div>
                </div>
              </div>

              {/* Detail card */}
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                <Row icon={<User className="w-4 h-4" />} label="User">
                  <span className="font-medium">{tx.username}</span>
                  <span className="text-muted-foreground text-xs ml-2">UID #{tx.userId}</span>
                  {tx.email && <span className="text-muted-foreground text-xs ml-2">· {tx.email}</span>}
                </Row>

                <Row icon={<Wallet className="w-4 h-4" />} label="Amount Requested">
                  <span className="font-mono font-semibold text-base">{amount.toFixed(6)} USDT</span>
                </Row>

                <Row icon={<span className="w-4 h-4 text-center text-xs font-bold leading-none">−</span>} label="Network Fee">
                  <span className="font-mono text-muted-foreground">{fee.toFixed(6)} USDT</span>
                </Row>

                <Row icon={<span className="w-4 h-4 text-center text-xs font-bold leading-none text-primary">→</span>} label="Net Amount to Send">
                  <span className="font-mono font-semibold text-primary">{netAmount.toFixed(6)} USDT</span>
                </Row>

                <Row icon={<Network className="w-4 h-4" />} label="Network">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">{tx.network ?? "TRC20"}</span>
                </Row>

                <Row icon={<Hash className="w-4 h-4" />} label="Destination Address">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs truncate max-w-[220px]">{tx.address ?? "—"}</span>
                    {tx.address && (
                      <button onClick={() => copy(tx.address)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </Row>

                <Row icon={<Clock className="w-4 h-4" />} label="Requested">
                  <span className="text-sm">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}</span>
                </Row>

                {tx.txid && (
                  <Row icon={<Hash className="w-4 h-4" />} label="Blockchain TXID">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs truncate max-w-[220px] text-green-400">{tx.txid}</span>
                      <button onClick={() => copy(tx.txid)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </Row>
                )}
              </div>

              {/* Action result */}
              {actionResult && (
                <div className={`rounded-xl px-4 py-3 text-sm border ${
                  actionResult.type === "success"
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  {actionResult.message}
                </div>
              )}

              {/* Actions — only show for pending withdrawals */}
              {tx.status === "pending" && (
                <div className="space-y-3">
                  {!showRejectForm ? (
                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {approving ? "Approving…" : "Approve & Send"}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 font-semibold rounded-xl transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="text-sm font-medium text-muted-foreground">Rejection reason (optional)</div>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="e.g. Suspicious destination address, KYC required…"
                        rows={3}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleReject}
                          disabled={rejecting}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                          {rejecting ? "Rejecting…" : "Confirm Rejection"}
                        </button>
                        <button
                          onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                          className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="text-muted-foreground w-4 flex-shrink-0">{icon}</div>
      <div className="text-xs text-muted-foreground w-36 flex-shrink-0">{label}</div>
      <div className="flex items-center gap-1 flex-1 min-w-0">{children}</div>
    </div>
  );
}
