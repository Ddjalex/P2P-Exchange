import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-warning/20 text-warning", paid: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success", cancelled: "bg-muted text-muted-foreground", appeal: "bg-destructive/20 text-destructive",
};

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    adminGet<any>(`/orders/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  const forceAction = async (type: "force-complete" | "force-cancel") => {
    if (!confirm(`Are you sure you want to ${type === "force-complete" ? "force complete" : "force cancel"} this order?`)) return;
    setActing(true);
    await adminPut(`/orders/${params.id}/${type}`, { note });
    const updated = await adminGet<any>(`/orders/${params.id}`);
    setData(updated);
    setActing(false);
  };

  if (loading) return <AdminGuard><AdminLayout title="Order Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="Order Detail"><div className="text-muted-foreground">Order not found</div></AdminLayout></AdminGuard>;

  const { order, buyer, seller, messages, appeal } = data;

  return (
    <AdminGuard>
      <AdminLayout title={`Order #${order.id}`}>
        <div className="mb-4">
          <Link href="/admin/orders" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Order info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Order Details</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>{order.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Order ID", `#${order.id}`], ["Amount (USDT)", `${parseFloat(order.amountUsdt).toFixed(2)} USDT`],
                  ["Amount (ETB)", `${parseFloat(order.amountEtb).toLocaleString()} ETB`], ["Price", `${parseFloat(order.price).toLocaleString()} ETB/USDT`],
                  ["Payment", order.paymentMethod], ["Time Limit", `${order.paymentTimeLimit} mins`],
                  ["Created", new Date(order.createdAt).toLocaleString()],
                  ["Completed", order.completedAt ? new Date(order.completedAt).toLocaleString() : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
                    <div className="font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              {[{ label: "Buyer", user: buyer }, { label: "Seller", user: seller }].map(({ label, user }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">{label}</div>
                  {user ? (
                    <>
                      <div className="font-semibold">{user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      <Link href={`/admin/users/${user.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">View profile →</Link>
                    </>
                  ) : <span className="text-muted-foreground text-sm">Unknown</span>}
                </div>
              ))}
            </div>

            {/* Chat history */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-sm">Chat History ({messages.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 ? <div className="text-muted-foreground text-sm text-center py-4">No messages</div> :
                  messages.map((m: any) => (
                    <div key={m.id} className="flex space-x-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs flex-shrink-0">
                        {m.senderId === buyer?.id ? 'B' : m.senderId === seller?.id ? 'S' : '⚙'}
                      </div>
                      <div>
                        <div className={`px-3 py-1.5 rounded-xl text-sm inline-block ${m.type === 'system' ? 'bg-secondary text-muted-foreground italic text-xs' : 'bg-card border border-border'}`}>
                          {m.content}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Appeal info */}
            {appeal && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
                <h3 className="font-semibold mb-3 text-sm text-destructive">Appeal Filed</h3>
                <div className="text-sm space-y-2">
                  <div><span className="text-muted-foreground">Reason: </span>{appeal.reason}</div>
                  <div><span className="text-muted-foreground">Description: </span>{appeal.description}</div>
                  <div><span className="text-muted-foreground">Status: </span><span className="capitalize">{appeal.status}</span></div>
                  {appeal.adminDecision && <div><span className="text-muted-foreground">Decision: </span>{appeal.adminDecision}</div>}
                  <Link href={`/admin/disputes/${appeal.id}`} className="text-xs text-primary hover:underline">View full dispute →</Link>
                </div>
              </div>
            )}
          </div>

          {/* Admin actions */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-sm">Admin Actions</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Admin Note</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for action..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-20 outline-none focus:border-primary" />
                </div>
                <button onClick={() => forceAction("force-complete")} disabled={acting || order.status === "completed"}
                  className="w-full py-2.5 bg-success/10 text-success border border-success/20 rounded-lg font-semibold text-sm hover:bg-success/20 transition-colors disabled:opacity-40">
                  Force Complete (Release to Buyer)
                </button>
                <button onClick={() => forceAction("force-cancel")} disabled={acting || order.status === "cancelled"}
                  className="w-full py-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-semibold text-sm hover:bg-destructive/20 transition-colors disabled:opacity-40">
                  Force Cancel (Return to Seller)
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-sm">Timeline</h3>
              <div className="space-y-3">
                {[
                  { label: "Created", date: order.createdAt, done: true },
                  { label: "Payment Sent", date: order.paidAt, done: !!order.paidAt },
                  { label: "Completed", date: order.completedAt, done: !!order.completedAt },
                ].map(step => (
                  <div key={step.label} className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${step.done ? 'bg-success' : 'bg-border'}`} />
                    <div>
                      <div className={`text-sm font-medium ${step.done ? '' : 'text-muted-foreground'}`}>{step.label}</div>
                      {step.date && <div className="text-xs text-muted-foreground">{new Date(step.date).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
