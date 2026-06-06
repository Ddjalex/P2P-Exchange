import { useEffect, useState, useRef } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost, adminPut } from "@/lib/admin-api";
import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";

export default function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [chatData, setChatData] = useState<{ messages: any[] } | null>(null);
  const [adminChatMessages, setAdminChatMessages] = useState<any[]>([]);
  const [activeAdminChat, setActiveAdminChat] = useState<"buyer" | "seller" | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [sending, setSending] = useState(false);
  const adminPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    setLoading(true);
    adminGet<any>(`/disputes/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [params.id]);

  useEffect(() => {
    if (!data?.order?.id) return;
    adminGet<{ messages: any[] }>(`/orders/${data.order.id}/messages`).then(setChatData).catch(() => {});
  }, [data?.order?.id]);

  const fetchAdminMessages = () => {
    adminGet<{ messages: any[] }>(`/disputes/${params.id}/messages`)
      .then(r => setAdminChatMessages(r.messages ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchAdminMessages();
    adminPollRef.current = setInterval(fetchAdminMessages, 5000);
    return () => {
      if (adminPollRef.current) clearInterval(adminPollRef.current);
    };
  }, [params.id]);

  const reloadChat = () => {
    if (!data?.order?.id) return;
    adminGet<{ messages: any[] }>(`/orders/${data.order.id}/messages`).then(setChatData).catch(() => {});
  };

  const handleSendAdminMessage = async () => {
    if (!adminMessage.trim() || !activeAdminChat || !data || sending) return;
    const { appeal, order } = data;
    const receiverId = activeAdminChat === "buyer" ? order.buyerId : order.sellerId;
    setSending(true);
    try {
      await adminPost(`/disputes/${appeal.id}/message`, { receiverId, content: adminMessage.trim() });
      setAdminMessage("");
      await fetchAdminMessages();
      reloadChat();
    } catch {
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

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

  const buyerMessageCount = adminChatMessages.filter((m: any) => m.receiverId === order?.buyerId).length;
  const sellerMessageCount = adminChatMessages.filter((m: any) => m.receiverId === order?.sellerId).length;

  const filteredAdminMessages = adminChatMessages.filter((m: any) =>
    m.receiverId === (activeAdminChat === "buyer" ? order?.buyerId : order?.sellerId)
  );

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
              <div style={{ background: "#0a1628", borderRadius: "12px", padding: "16px", maxHeight: "400px", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Full Chat History ({chatData?.messages?.length ?? messages.length})
                  </h3>
                  <span style={{ color: "#8899aa", fontSize: "12px" }}>Read only</span>
                </div>

                {(chatData?.messages ?? messages).length === 0 ? (
                  <div style={{ color: "#8899aa", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No messages</div>
                ) : (chatData?.messages ?? messages).map((msg: any) => {
                  const isBuyerMsg = msg.senderId === buyer?.id;
                  const isSellerMsg = msg.senderId === seller?.id;
                  const isAdmin = msg.senderId === -1 || msg.type === "admin";

                  if (msg.type === "system" || (!msg.senderId && msg.type !== "admin")) {
                    return (
                      <div key={msg.id} style={{ textAlign: "center", margin: "8px 0" }}>
                        <span style={{ background: "rgba(255,255,255,0.06)", color: "#8899aa", fontSize: "11px", padding: "4px 12px", borderRadius: "12px", display: "inline-block" }}>
                          {msg.content}
                        </span>
                        <div style={{ color: "#445566", fontSize: "10px", marginTop: "2px" }}>{new Date(msg.createdAt).toLocaleString()}</div>
                      </div>
                    );
                  }

                  if (isAdmin) {
                    return (
                      <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: "12px" }}>
                        <span style={{ color: "#00e676", fontSize: "10px", fontWeight: 600, marginBottom: "3px" }}>Admin (private)</span>
                        <div style={{ maxWidth: "75%", background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)", borderRadius: "12px", padding: "8px 12px" }}>
                          <p style={{ color: "#fff", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                        </div>
                        <span style={{ color: "#445566", fontSize: "10px", marginTop: "2px" }}>{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                    );
                  }

                  const senderLabel = isBuyerMsg ? "Buyer" : isSellerMsg ? "Seller" : "Other";
                  const senderColor = isBuyerMsg ? "#00e5ff" : "#ff8800";
                  const alignRight = isBuyerMsg;

                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: alignRight ? "flex-end" : "flex-start", marginBottom: "12px" }}>
                      <span style={{ color: senderColor, fontSize: "10px", fontWeight: 600, marginBottom: "3px" }}>
                        {senderLabel} · {msg.senderUsername ?? ""}
                      </span>
                      <div style={{ maxWidth: "75%", background: alignRight ? "rgba(0,229,255,0.1)" : "rgba(255,136,0,0.08)", border: `1px solid ${alignRight ? "rgba(0,229,255,0.2)" : "rgba(255,136,0,0.2)"}`, borderRadius: "12px", padding: "8px 12px" }}>
                        {msg.type === "image" && msg.content && (
                          <img src={msg.content} alt="Evidence" style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "8px", display: "block", cursor: "pointer" }} onClick={() => setLightboxUrl(msg.content)} />
                        )}
                        {msg.content && msg.type !== "image" && (
                          <p style={{ color: "#fff", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                        )}
                      </div>
                      <span style={{ color: "#445566", fontSize: "10px", marginTop: "2px" }}>{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Admin Chat Buttons */}
              {order && appeal.status !== "resolved" && (
                <>
                  <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                    <button
                      onClick={() => setActiveAdminChat(activeAdminChat === "buyer" ? null : "buyer")}
                      style={{ flex: 1, padding: "12px", background: activeAdminChat === "buyer" ? "rgba(0,229,255,0.15)" : "transparent", border: `1.5px solid ${activeAdminChat === "buyer" ? "#00e5ff" : "#334455"}`, borderRadius: "10px", color: activeAdminChat === "buyer" ? "#00e5ff" : "#8899aa", fontSize: "13px", fontWeight: 600, cursor: "pointer", position: "relative" }}
                    >
                      💬 Chat with Buyer
                      {buyerMessageCount > 0 && (
                        <span style={{ background: "#00e5ff", color: "#1a1a2e", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: 700, marginLeft: "6px" }}>
                          {buyerMessageCount}
                        </span>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: 400, marginTop: "2px", opacity: 0.7 }}>{buyer?.username ?? "—"}</div>
                    </button>
                    <button
                      onClick={() => setActiveAdminChat(activeAdminChat === "seller" ? null : "seller")}
                      style={{ flex: 1, padding: "12px", background: activeAdminChat === "seller" ? "rgba(255,136,0,0.15)" : "transparent", border: `1.5px solid ${activeAdminChat === "seller" ? "#ff8800" : "#334455"}`, borderRadius: "10px", color: activeAdminChat === "seller" ? "#ff8800" : "#8899aa", fontSize: "13px", fontWeight: 600, cursor: "pointer", position: "relative" }}
                    >
                      💬 Chat with Seller
                      {sellerMessageCount > 0 && (
                        <span style={{ background: "#ff8800", color: "#1a1a2e", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: 700, marginLeft: "6px" }}>
                          {sellerMessageCount}
                        </span>
                      )}
                      <div style={{ fontSize: "10px", fontWeight: 400, marginTop: "2px", opacity: 0.7 }}>{seller?.username ?? "—"}</div>
                    </button>
                  </div>

                  {activeAdminChat && (
                    <div style={{ marginTop: "16px", background: "#0a1628", border: `1px solid ${activeAdminChat === "buyer" ? "rgba(0,229,255,0.3)" : "rgba(255,136,0,0.3)"}`, borderRadius: "12px", overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: activeAdminChat === "buyer" ? "rgba(0,229,255,0.08)" : "rgba(255,136,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: activeAdminChat === "buyer" ? "#00e5ff" : "#ff8800", fontSize: "13px", fontWeight: 600 }}>
                          🔒 Private — Admin → {activeAdminChat === "buyer" ? "Buyer" : "Seller"}
                        </span>
                        <button onClick={() => setActiveAdminChat(null)} style={{ background: "none", border: "none", color: "#8899aa", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>×</button>
                      </div>

                      <div style={{ padding: "12px 16px", maxHeight: "200px", overflowY: "auto" }}>
                        {filteredAdminMessages.length === 0 ? (
                          <p style={{ color: "#556677", fontSize: "12px", textAlign: "center" }}>No messages yet. Send a private message below.</p>
                        ) : filteredAdminMessages.map((m: any) => (
                          <div key={m.id} style={{ marginBottom: "8px" }}>
                            <div style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)", borderRadius: "8px", padding: "8px 12px", display: "inline-block", maxWidth: "80%" }}>
                              <p style={{ color: "#fff", fontSize: "12px", margin: 0 }}>{m.content}</p>
                            </div>
                            <div style={{ color: "#445566", fontSize: "10px", marginTop: "2px" }}>Admin · {new Date(m.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e2d3d", display: "flex", gap: "8px" }}>
                        <input
                          value={adminMessage}
                          onChange={e => setAdminMessage(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendAdminMessage()}
                          placeholder={`Private message to ${activeAdminChat === "buyer" ? "buyer" : "seller"}...`}
                          style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid #334455", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "13px", outline: "none" }}
                        />
                        <button
                          onClick={handleSendAdminMessage}
                          disabled={!adminMessage.trim() || sending}
                          style={{ padding: "10px 16px", background: activeAdminChat === "buyer" ? "#00e5ff" : "#ff8800", border: "none", borderRadius: "8px", color: "#1a1a2e", fontWeight: 700, cursor: "pointer", fontSize: "13px", opacity: (!adminMessage.trim() || sending) ? 0.5 : 1 }}
                        >
                          {sending ? "..." : "Send"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
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
