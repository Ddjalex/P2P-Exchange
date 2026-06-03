import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    adminGet<any>(`/disputes/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  const resolve = async () => {
    if (!decision) { alert("Please select a decision."); return; }
    if (!confirm("Resolve this dispute? This action cannot be undone.")) return;
    setResolving(true);
    await adminPut(`/disputes/${params.id}/resolve`, { decision, adminNote });
    const updated = await adminGet<any>(`/disputes/${params.id}`);
    setData(updated);
    setResolving(false);
  };

  if (loading) return <AdminGuard><AdminLayout title="Dispute Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="Dispute Detail"><div className="text-muted-foreground">Dispute not found</div></AdminLayout></AdminGuard>;

  const { appeal, order, raiser, buyer, seller, messages } = data;

  return (
    <AdminGuard>
      <AdminLayout title={`Dispute #${appeal.id}`}>
        <div className="mb-4">
          <Link href="/admin/disputes" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Disputes
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left — Evidence & info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Order summary */}
            {order && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Order ID", `#${order.id}`], ["Amount", `${parseFloat(order.amountUsdt).toFixed(2)} USDT / ${parseFloat(order.amountEtb).toLocaleString()} ETB`],
                    ["Buyer", buyer?.username ?? "Unknown"], ["Seller", seller?.username ?? "Unknown"],
                    ["Payment", order.paymentMethod], ["Status", order.status],
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v}</span></div>
                  ))}
                </div>
                <Link href={`/admin/orders/${order.id}`} className="text-xs text-primary hover:underline mt-2 inline-block">View full order →</Link>
              </div>
            )}

            {/* Appeal details */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Appeal Details</h3>
              <div className="space-y-3 text-sm">
                <div><span className="text-muted-foreground">Raised by: </span><span className="font-medium">{raiser?.username}</span></div>
                <div><span className="text-muted-foreground">Reason: </span><span className="font-medium">{appeal.reason}</span></div>
                <div><span className="text-muted-foreground">Description: </span><p className="mt-1 text-foreground/80">{appeal.description}</p></div>
                <div><span className="text-muted-foreground">Filed: </span>{new Date(appeal.createdAt).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Status: </span>
                  <span className={`font-medium capitalize ${appeal.status === 'pending' ? 'text-warning' : 'text-success'}`}>{appeal.status}</span>
                </div>
                {appeal.adminDecision && <div><span className="text-muted-foreground">Decision: </span><span className="font-medium">{appeal.adminDecision}</span></div>}
              </div>
            </div>

            {/* Evidence */}
            {appeal.evidenceUrls?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-3">Evidence ({appeal.evidenceUrls.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {appeal.evidenceUrls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block h-32 bg-secondary rounded-lg border border-border overflow-hidden hover:border-primary transition-colors">
                      <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Chat history */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Chat History ({messages.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 ? <div className="text-muted-foreground text-sm text-center py-4">No messages</div> :
                  messages.map((m: any) => (
                    <div key={m.id} className="text-sm">
                      <div className={`px-3 py-1.5 rounded-xl inline-block max-w-[80%] ${m.type === 'system' ? 'bg-secondary text-muted-foreground italic text-xs' : 'bg-card border border-border'}`}>
                        {m.content}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right — Admin decision */}
          <div>
            <div className="bg-card border border-border rounded-xl p-5 sticky top-4">
              <h3 className="font-semibold mb-4">Admin Decision</h3>
              {appeal.status === "resolved" ? (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">
                  ✓ Resolved: {appeal.adminDecision?.replace(/_/g, ' ')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium block">Rule in favor of:</label>
                    {[
                      { value: "buyer_wins", label: "🏆 Buyer — Release USDT to buyer" },
                      { value: "seller_wins", label: "🏆 Seller — Return USDT to seller" },
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${decision === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                        <input type="radio" name="decision" value={opt.value} checked={decision === opt.value} onChange={e => setDecision(e.target.value)} className="mt-0.5" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Admin Note (shown to both parties)</label>
                    <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Explain your decision..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-24 outline-none focus:border-primary" />
                  </div>
                  <button onClick={resolve} disabled={resolving || !decision}
                    className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40">
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
