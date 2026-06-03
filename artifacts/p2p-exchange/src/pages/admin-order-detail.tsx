import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminPost } from "@/lib/admin-api";
import { Link } from "wouter";
import { ArrowLeft, Copy, Lock, Unlock, Flag, StickyNote } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-yellow-500/15 text-yellow-400", paid: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success", cancelled: "bg-muted text-muted-foreground",
  appeal: "bg-destructive/15 text-destructive",
};

function TimelineStep({ label, date, done, active }: { label: string; date?: string | null; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-start space-x-3">
      <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2 ${done ? 'bg-success border-success' : active ? 'border-primary bg-primary/20' : 'border-border bg-background'}`} />
      <div>
        <div className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</div>
        {date && <div className="text-[11px] text-muted-foreground">{new Date(date).toLocaleString()}</div>}
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"force-release" | "force-cancel" | null>(null);
  const [confirmNote, setConfirmNote] = useState("");

  const load = () => {
    setLoading(true);
    adminGet<any>(`/orders/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params.id]);

  const doForceAction = async () => {
    if (!confirmAction) return;
    setActing(true);
    const endpoint = confirmAction === "force-release" ? "force-complete" : "force-cancel";
    await adminPut(`/orders/${params.id}/${endpoint}`, { note: confirmNote });
    setConfirmAction(null);
    setConfirmNote("");
    load();
    setActing(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await adminPut(`/orders/${params.id}/add-note`, { note });
    load();
    setNote("");
  };

  if (loading) return <AdminGuard><AdminLayout title="Order Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="Order Detail"><div className="text-muted-foreground">Order not found</div></AdminLayout></AdminGuard>;

  const { order, buyer, seller, messages, appeal } = data;
  const isFrozen = ["unpaid", "paid", "appeal"].includes(order.status);

  return (
    <AdminGuard>
      <AdminLayout title={`Order #${order.id}`}>
        {/* Confirm Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-bold text-lg mb-2">
                {confirmAction === "force-release" ? "🔓 Force Release" : "🔒 Force Cancel"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {confirmAction === "force-release"
                  ? `This will release ${parseFloat(order.amountUsdt).toFixed(4)} USDT to the buyer. This action cannot be undone.`
                  : `This will return ${parseFloat(order.amountUsdt).toFixed(4)} USDT to the seller and cancel the order.`}
              </p>
              <textarea
                value={confirmNote}
                onChange={e => setConfirmNote(e.target.value)}
                placeholder="Reason for action (required)..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-20 outline-none focus:border-primary mb-4"
              />
              <div className="flex space-x-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={doForceAction} disabled={acting || !confirmNote.trim()}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 ${confirmAction === "force-release" ? "bg-success text-white" : "bg-destructive text-white"}`}>
                  {acting ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Link href="/admin/orders" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* USDT Freeze Status */}
            <div className={`flex items-center justify-between p-4 rounded-xl border ${isFrozen ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
              <div className="flex items-center space-x-3">
                {isFrozen ? <Lock className="w-5 h-5 text-destructive" /> : <Unlock className="w-5 h-5 text-success" />}
                <div>
                  <div className={`font-semibold text-sm ${isFrozen ? "text-destructive" : "text-success"}`}>
                    USDT Status: {isFrozen ? "FROZEN" : "Released"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {parseFloat(order.amountUsdt).toFixed(4)} USDT
                    {isFrozen && order.frozenAt && ` · Frozen since ${new Date(order.frozenAt).toLocaleString()}`}
                    {!isFrozen && order.releasedAt && ` · Released ${new Date(order.releasedAt).toLocaleString()}`}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}>{order.status}</span>
            </div>

            {/* Order details */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Order Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Order ID", `#${order.id}`],
                  ["Amount (USDT)", `${parseFloat(order.amountUsdt).toFixed(4)} USDT`],
                  ["Amount (ETB)", `${parseFloat(order.amountEtb).toLocaleString()} ETB`],
                  ["Price", `${parseFloat(order.price).toLocaleString()} ETB/USDT`],
                  ["Payment Method", order.paymentMethod],
                  ["Time Limit", `${order.paymentTimeLimit} min`],
                  ["Created", new Date(order.createdAt).toLocaleString()],
                  ["Paid At", order.paidAt ? new Date(order.paidAt).toLocaleString() : "—"],
                  ["Completed", order.completedAt ? new Date(order.completedAt).toLocaleString() : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
                    <div className="font-medium">{v}</div>
                  </div>
                ))}
              </div>
              {order.adminNote && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <div className="text-xs text-warning font-semibold mb-1">Admin Note</div>
                  <div className="text-sm">{order.adminNote}</div>
                </div>
              )}
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              {[{ label: "Buyer", u: buyer }, { label: "Seller", u: seller }].map(({ label, u }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">{label}</div>
                  {u ? (
                    <>
                      <div className="font-semibold">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.kycStatus && <div className={`text-xs mt-1 ${u.kycStatus === 'verified' ? 'text-success' : 'text-warning'}`}>KYC: {u.kycStatus}</div>}
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">View profile →</Link>
                    </>
                  ) : <span className="text-muted-foreground text-sm">Unknown</span>}
                </div>
              ))}
            </div>

            {/* Chat history */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-sm">Chat History ({messages.length})</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {messages.length === 0
                  ? <div className="text-muted-foreground text-sm text-center py-4">No messages</div>
                  : messages.map((m: any) => (
                    <div key={m.id} className="flex space-x-2 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${m.senderId === buyer?.id ? 'bg-primary/20 text-primary' : m.senderId === seller?.id ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'}`}>
                        {m.senderId === buyer?.id ? 'B' : m.senderId === seller?.id ? 'S' : '⚙'}
                      </div>
                      <div className="flex-1">
                        <div className={`px-3 py-1.5 rounded-xl inline-block max-w-[85%] ${m.type === 'system' ? 'bg-secondary text-muted-foreground italic text-xs' : 'bg-card border border-border'}`}>
                          {m.content}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Appeal */}
            {appeal && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
                <h3 className="font-semibold mb-3 text-sm text-destructive">Appeal Filed</h3>
                <div className="text-sm space-y-2">
                  <div><span className="text-muted-foreground">Reason: </span>{appeal.reason}</div>
                  <div><span className="text-muted-foreground">Description: </span>{appeal.description}</div>
                  <div><span className="text-muted-foreground">Status: </span><span className="capitalize">{appeal.status}</span></div>
                  {appeal.adminDecision && <div><span className="text-muted-foreground">Decision: </span>{appeal.adminDecision.replace(/_/g, ' ')}</div>}
                  <Link href={`/admin/disputes/${appeal.id}`} className="text-xs text-primary hover:underline">View full dispute →</Link>
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Admin Actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 text-sm">Admin Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setConfirmAction("force-release")}
                  disabled={acting || ["completed", "cancelled"].includes(order.status)}
                  className="w-full py-2.5 bg-success/10 text-success border border-success/20 rounded-lg font-semibold text-sm hover:bg-success/20 transition-colors disabled:opacity-40 flex items-center justify-center space-x-2"
                >
                  <Unlock className="w-4 h-4" /><span>Force Release to Buyer</span>
                </button>
                <button
                  onClick={() => setConfirmAction("force-cancel")}
                  disabled={acting || ["completed", "cancelled"].includes(order.status)}
                  className="w-full py-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-semibold text-sm hover:bg-destructive/20 transition-colors disabled:opacity-40 flex items-center justify-center space-x-2"
                >
                  <Lock className="w-4 h-4" /><span>Force Cancel (Return to Seller)</span>
                </button>
                <div className="pt-2 border-t border-border">
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center space-x-1"><StickyNote className="w-3 h-3" /><span>Add Internal Note</span></label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Internal admin note (not shown to users)..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-20 outline-none focus:border-primary mb-2"
                  />
                  <button onClick={addNote} disabled={!note.trim()} className="w-full py-2 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40">
                    Save Note
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 text-sm">Order Timeline</h3>
              <div className="space-y-3 relative">
                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
                <TimelineStep label="Order Created" date={order.createdAt} done />
                <TimelineStep label="Payment Marked by Buyer" date={order.paidAt} done={!!order.paidAt} active={order.status === "unpaid"} />
                <TimelineStep label="Waiting for Seller Release" date={null} done={!!order.completedAt || !!order.cancelReason} active={order.status === "paid"} />
                {order.status === "completed" && <TimelineStep label="Completed" date={order.completedAt} done />}
                {order.status === "cancelled" && <TimelineStep label="Cancelled" date={null} done />}
                {order.status === "appeal" && <TimelineStep label="Appeal Raised" date={null} done active />}
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
