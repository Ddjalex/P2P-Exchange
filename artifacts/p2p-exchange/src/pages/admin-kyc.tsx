import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-warning/20", text: "text-warning", label: "Pending" },
  verified: { bg: "bg-success/20", text: "text-success", label: "Verified" },
  rejected: { bg: "bg-destructive/20", text: "text-destructive", label: "Rejected" },
  more_info_required: { bg: "bg-orange-500/20", text: "text-orange-400", label: "More Info" },
};

function KycBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

export default function AdminKycPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [decision, setDecision] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [imageModal, setImageModal] = useState<string | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const [data, statsData] = await Promise.all([
        adminGet<any[]>(`/kyc?${params}`),
        adminGet<any>("/kyc/stats"),
      ]);
      setSubs(data);
      setStats(statsData);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadList(); }, [statusFilter]);
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [search]);

  const selectItem = async (sub: any) => {
    try {
      const detail = await adminGet<any>(`/kyc/${sub.userId}`);
      setSelected(detail);
    } catch { setSelected(sub); }
    setDecision(""); setRejectionReason(""); setAdminMessage("");
  };

  const submitReview = async () => {
    if (!decision) { alert("Select a decision."); return; }
    if ((decision === "rejected" || decision === "more_info_required") && !rejectionReason) {
      alert("Please provide a reason."); return;
    }
    setReviewing(true);
    try {
      const updated = await adminPost<any>(`/kyc/${selected.userId}/review`, { decision, rejectionReason, adminMessage });
      setSelected(updated);
      loadList();
    } catch (e: any) { alert(e.message); }
    setReviewing(false);
  };

  return (
    <AdminGuard>
      <AdminLayout title="KYC Verification">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Pending Review", value: stats?.byStatus?.pending ?? 0, color: "text-warning" },
            { label: "Verified", value: stats?.byStatus?.verified ?? 0, color: "text-success" },
            { label: "Rejected", value: stats?.byStatus?.rejected ?? 0, color: "text-destructive" },
            { label: "Approved Today", value: stats?.approvedToday ?? 0, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Sidebar list */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border space-y-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or user ID..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                <div className="flex space-x-1">
                  {[
                    { v: "pending", l: "Pending" },
                    { v: "verified", l: "Verified" },
                    { v: "rejected", l: "Rejected" },
                    { v: "more_info_required", l: "Info" },
                  ].map(s => (
                    <button key={s.v} onClick={() => setStatusFilter(s.v)}
                      className={`flex-1 py-1 px-1 rounded text-[10px] font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:border-primary'}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto max-h-[520px]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 border-b border-border/50">
                      <div className="h-12 bg-secondary rounded animate-pulse" />
                    </div>
                  ))
                ) : subs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No submissions found</div>
                ) : subs.map(sub => (
                  <button key={sub.id} onClick={() => selectItem(sub)}
                    className={`w-full text-left p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors ${selected?.userId === sub.userId ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-medium text-sm truncate">{sub.fullName ?? sub.username}</div>
                      <KycBadge status={sub.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">@{sub.username} · {sub.nationality}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center space-x-1">
                      {sub.isOld && sub.status === 'pending' && <Clock className="w-3 h-3 text-yellow-400" />}
                      <span>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="bg-card border border-border rounded-xl h-64 flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">Select a KYC submission to review</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* User info */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-bold text-lg">{selected.fullName}</div>
                      <div className="text-sm text-muted-foreground">@{selected.username} · {selected.email}</div>
                    </div>
                    <KycBadge status={selected.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Date of Birth", selected.dateOfBirth],
                      ["Nationality", selected.nationality],
                      ["ID Type", selected.idType?.replace('_', ' ')],
                      ["User ID", `#${selected.userId}`],
                    ].map(([k, v]) => (
                      <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium capitalize">{v ?? "—"}</span></div>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">Documents</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "ID Front", url: selected.frontImageUrl },
                      { label: "ID Back", url: selected.backImageUrl },
                      { label: "Selfie", url: selected.selfieUrl },
                    ].map(doc => (
                      <div key={doc.label}>
                        <div className="text-xs text-muted-foreground mb-1">{doc.label}</div>
                        {doc.url ? (
                          <button onClick={() => setImageModal(doc.url!)} className="w-full h-28 bg-secondary rounded-lg border border-border overflow-hidden hover:border-primary transition-colors">
                            <img src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
                          </button>
                        ) : <div className="h-28 bg-secondary rounded-lg border border-border flex items-center justify-center text-muted-foreground text-xs">N/A</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review actions */}
                {(selected.status === "pending" || selected.status === "more_info_required") ? (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-sm mb-4">Review Decision</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "verified", label: "✓ Approve", cls: "border-success text-success bg-success/10 hover:bg-success/20" },
                          { value: "rejected", label: "✗ Reject", cls: "border-destructive text-destructive bg-destructive/10 hover:bg-destructive/20" },
                          { value: "more_info_required", label: "? More Info", cls: "border-yellow-500 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20" },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => setDecision(opt.value)}
                            className={`py-2.5 rounded-lg border font-medium text-sm transition-colors ${decision === opt.value ? opt.cls + ' ring-1 ring-current' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {(decision === "rejected" || decision === "more_info_required") && (
                        <input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                          placeholder="Reason (shown to user)..."
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                      )}
                      <textarea value={adminMessage} onChange={e => setAdminMessage(e.target.value)}
                        placeholder="Admin note (optional — visible to user)..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-16 outline-none focus:border-primary" />
                      <button onClick={submitReview} disabled={reviewing || !decision}
                        className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40">
                        {reviewing ? "Submitting..." : "Submit Review"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl border ${selected.status === 'verified' ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}`}>
                    <div className="font-semibold text-sm mb-1 flex items-center space-x-2">
                      {selected.status === 'verified' ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      <span>{selected.status === 'verified' ? 'Verified' : 'Rejected'}</span>
                      {selected.reviewedAt && <span className="text-muted-foreground font-normal text-xs">{new Date(selected.reviewedAt).toLocaleString()}</span>}
                    </div>
                    {selected.rejectionReason && <p className="text-sm text-muted-foreground mt-1">{selected.rejectionReason}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Image modal */}
        {imageModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
            <img src={imageModal} alt="Document" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
