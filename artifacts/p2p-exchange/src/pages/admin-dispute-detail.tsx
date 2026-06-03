import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";
import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";

export default function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminGet<any>(`/disputes/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [params.id]);

  const resolve = async () => {
    if (!decision) { alert("Please select a decision."); return; }
    if (!confirm("Resolve this dispute? This action cannot be undone.")) return;
    setResolving(true);
    await adminPut(`/disputes/${params.id}/resolve`, { decision, adminNote });
    load();
    setResolving(false);
  };

  if (loading) return <AdminGuard><AdminLayout title="Dispute Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="Dispute Detail"><div className="text-muted-foreground">Dispute not found</div></AdminLayout></AdminGuard>;

  const { appeal, order, raiser, buyer, seller, messages } = data;

  return (
    <AdminGuard>
      <AdminLayout title={`Dispute #${appeal.id}`}>
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Evidence" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        )}

        <div className="mb-4">
          <Link href="/admin/disputes" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Disputes
          </Link>
        </div>

        {/* USDT Frozen Banner */}
        {order && appeal.status !== "resolved" && (
          <div className="flex items-center space-x-3 p-4 mb-5 bg-destructive/5 border border-destructive/20 rounded-xl">
            <Lock className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <div className="font-semibold text-sm text-destructive">
                {parseFloat(order.amountUsdt).toFixed(4)} USDT currently FROZEN — awaiting admin decision
              </div>
              <div className="text-xs text-muted-foreground">Order #{order.id} · {order.paymentMethod}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Appeal Details */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Appeal Details</h3>
              <div className="space-y-3 text-sm">
                <div><span className="text-muted-foreground">Raised by: </span><span className="font-medium">{raiser?.username}</span></div>
                <div><span className="text-muted-foreground">Reason: </span><span className="font-medium">{appeal.reason}</span></div>
                <div><span className="text-muted-foreground">Description: </span><p className="mt-1 text-foreground/80 leading-relaxed">{appeal.description}</p></div>
                <div><span className="text-muted-foreground">Filed: </span>{new Date(appeal.createdAt).toLocaleString()}</div>
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${appeal.status === 'pending' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
                    {appeal.status}
                  </span>
                </div>
                {appeal.adminDecision && (
                  <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                    <span className="text-muted-foreground">Decision: </span><span className="font-medium">{appeal.adminDecision.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Both Parties */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Buyer", u: buyer, role: "buyer", didAct: !!order?.paidAt },
                { label: "Seller", u: seller, role: "seller", didAct: !!order?.completedAt },
              ].map(({ label, u, role, didAct }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">{label}</div>
                  {u ? (
                    <>
                      <div className="font-semibold text-sm">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      <div className={`text-xs mt-1.5 font-medium ${u.kycStatus === 'verified' ? 'text-success' : 'text-warning'}`}>
                        KYC: {u.kycStatus}
                      </div>
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${u.isSuspended ? 'bg-destructive/15 text-destructive' : 'bg-success/10 text-success'}`}>
                        {u.isSuspended ? 'Suspended' : 'Active'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {role === 'buyer' ? `Marked paid: ${didAct ? 'Yes' : 'No'}` : `Released crypto: ${didAct ? 'Yes' : 'No'}`}
                      </div>
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">View profile →</Link>
                    </>
                  ) : <span className="text-muted-foreground text-sm">Unknown</span>}
                </div>
              ))}
            </div>

            {/* Order Summary */}
            {order && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Order ID", `#${order.id}`],
                    ["Amount", `${parseFloat(order.amountUsdt).toFixed(4)} USDT`],
                    ["ETB Amount", `${parseFloat(order.amountEtb).toLocaleString()} ETB`],
                    ["Payment", order.paymentMethod],
                    ["Created", new Date(order.createdAt).toLocaleString()],
                    ["Status", order.status],
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v}</span></div>
                  ))}
                </div>
                <Link href={`/admin/orders/${order.id}`} className="text-xs text-primary hover:underline mt-3 inline-block">View full order →</Link>
              </div>
            )}

            {/* Evidence */}
            {appeal.evidenceUrls?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3">Evidence ({appeal.evidenceUrls.length} files)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {appeal.evidenceUrls.map((url: string, i: number) => (
                    <button key={i} onClick={() => setLightboxUrl(url)}
                      className="block h-32 bg-secondary rounded-lg border border-border overflow-hidden hover:border-primary transition-colors">
                      <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover"
                        onError={e => { (e.currentTarget.parentElement as any).innerHTML = `<div class="h-full flex items-center justify-center text-xs text-muted-foreground">File ${i + 1}</div>`; }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat History */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Full Chat History ({messages.length})</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {messages.length === 0
                  ? <div className="text-muted-foreground text-sm text-center py-4">No messages</div>
                  : messages.map((m: any) => (
                    <div key={m.id} className={`flex ${m.senderId === buyer?.id ? "justify-start" : m.senderId === seller?.id ? "justify-end" : "justify-center"}`}>
                      <div>
                        {m.type === 'system' ? (
                          <div className="px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs italic text-center">{m.content}</div>
                        ) : (
                          <div className={`px-3 py-1.5 rounded-xl text-sm max-w-xs ${m.senderId === buyer?.id ? 'bg-primary/10 border border-primary/20' : 'bg-card border border-border'}`}>
                            <div className="text-[10px] text-muted-foreground mb-0.5">{m.senderId === buyer?.id ? 'Buyer' : 'Seller'}</div>
                            {m.content}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5 text-center">{new Date(m.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Admin Decision */}
          <div>
            <div className="bg-card border border-border rounded-xl p-5 sticky top-4">
              <h3 className="font-semibold mb-4">Admin Decision</h3>
              {appeal.status === "resolved" ? (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="text-success font-bold mb-1">✓ Resolved</div>
                  <div className="text-sm text-foreground/80">{appeal.adminDecision?.replace(/_/g, ' ')}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium block">Rule in favor of:</label>
                    {[
                      { value: "buyer_wins", label: "🏆 Buyer wins", sub: "Release USDT to buyer" },
                      { value: "seller_wins", label: "🏆 Seller wins", sub: "Return USDT to seller" },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${decision === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                        <input type="radio" name="decision" value={opt.value} checked={decision === opt.value} onChange={e => setDecision(e.target.value)} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.sub}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Reason (shown to both parties)</label>
                    <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Explain your decision..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-24 outline-none focus:border-primary" />
                  </div>
                  <button onClick={resolve} disabled={resolving || !decision}
                    className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40">
                    {resolving ? "Resolving..." : "Resolve Dispute"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
