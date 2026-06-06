import { AppLayout } from "@/components/layout";
import { ArrowLeft, AlertTriangle, ChevronRight } from "lucide-react";
import { useGetMessages, useGetOrder, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function ChatThreadPage() {
  const { orderId: id } = useParams();
  const orderId = Number(id);
  const { data: messages, isLoading: loadingMsgs } = useGetMessages(orderId, {
    query: { enabled: !!orderId, queryKey: getGetMessagesQueryKey(orderId), refetchInterval: 3000, refetchIntervalInBackground: false },
  });
  const { data: order } = useGetOrder(orderId, { query: { enabled: !!orderId, refetchInterval: 5000 } });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Message state
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [warningExpanded, setWarningExpanded] = useState(false);
  const [paymentCountdown, setPaymentCountdown] = useState(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Payment countdown timer
  useEffect(() => {
    if (!order || order.status !== "unpaid") return;
    const deadline = new Date(order.createdAt).getTime() + order.paymentTimeLimit * 60 * 1000;
    const tick = () => setPaymentCountdown(Math.max(0, deadline - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  // FIX 5 — Mark messages as read when chat is opened
  useEffect(() => {
    if (!orderId) return;
    const token = localStorage.getItem("p2p_token");
    fetch(`/api/messages/${orderId}/read`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["badge-chat"] });
    }).catch(() => {});
  }, [orderId]);

  // Live online status for counterparty
  const isBuyer = user?.id === order?.buyerId;
  const counterpartyName = isBuyer ? order?.sellerUsername : order?.buyerUsername;
  const counterpartyId = order ? (isBuyer ? order.sellerId : order.buyerId) : null;
  const [counterpartyOnline, setCounterpartyOnline] = useState(false);
  const [counterpartyLastActive, setCounterpartyLastActive] = useState<string | null>(null);

  useEffect(() => {
    if (!counterpartyId) return;
    const token = localStorage.getItem("p2p_token");
    const poll = () => {
      fetch(`/api/users/${counterpartyId}/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setCounterpartyOnline(data.online);
            setCounterpartyLastActive(data.lastActiveAt ?? null);
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [counterpartyId]);

  function lastSeenShort(lastActiveAt: string | null): string {
    if (!lastActiveAt) return "last seen a while ago";
    const diffMs = Date.now() - new Date(lastActiveAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "last seen just now";
    if (mins < 60) return `last seen ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `last seen ${hours}h ago`;
    return `last seen ${Math.floor(hours / 24)}d ago`;
  }

  const statusText = {
    unpaid: "Waiting for payment",
    paid: "Payment marked — awaiting release",
    completed: "Order completed",
    cancelled: "Order cancelled",
    appeal: "Under appeal",
  }[order?.status ?? "unpaid"] ?? order?.status;

  // FIX 1 — Image selection: only preview, do NOT auto-send
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  // FIX 1 — Send: handles both text and image; Enter key works
  const handleSendMessage = async () => {
    if ((!content.trim() && !selectedImage) || sending) return;
    const token = localStorage.getItem("p2p_token");
    setSending(true);
    try {
      if (selectedImage) {
        const formData = new FormData();
        formData.append("image", selectedImage);
        const res = await fetch(`/api/messages/${orderId}/image`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        setSelectedImage(null);
        setImagePreview(null);
      } else {
        const res = await fetch(`/api/messages/${orderId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: content.trim(), type: "text" }),
        });
        if (!res.ok) throw new Error("Send failed");
        setContent("");
      }
      queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(orderId) });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const canSend = (content.trim().length > 0 || !!selectedImage) && !sending;

  return (
    <AppLayout showNav={false}>
      {/* Header */}
      <header className="flex flex-col border-b border-border bg-background sticky top-0 z-20">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href={order ? `/trade/${order.id}` : "/chat"} className="text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-sm">{counterpartyName ?? "Loading..."}</h1>
              {counterpartyOnline ? (
                <div className="flex items-center space-x-1">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-success" />
                  </span>
                  <span className="text-xs text-success">Online</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {counterpartyLastActive ? lastSeenShort(counterpartyLastActive) : statusText}
                </p>
              )}
            </div>
          </div>
          {order && (
            <Link href={`/trade/${order.id}`} className="text-xs text-primary font-semibold hover:underline">
              View Order
            </Link>
          )}
        </div>

        {/* Status bar — buyer: show Pay button; seller: show "waiting" */}
        {order && order.status === "unpaid" && isBuyer && (
          <div className="px-4 py-2.5 bg-secondary/60 flex items-center justify-between text-xs border-t border-border">
            <div>
              <span className="text-muted-foreground mr-1">Transfer</span>
              <span className="font-bold font-mono text-primary">{Number(order.amountEtb).toLocaleString()} ETB</span>
              <span className="text-muted-foreground ml-2">within</span>
              <span className="font-mono text-primary font-bold ml-1">{formatCountdown(paymentCountdown)}</span>
            </div>
            <Link href={`/trade/${order.id}`} className="px-3 py-1 bg-primary text-primary-foreground rounded-full font-semibold">Pay</Link>
          </div>
        )}
        {order && order.status === "unpaid" && !isBuyer && (
          <div className="px-4 py-2.5 bg-secondary/60 flex items-center justify-between text-xs border-t border-border">
            <span className="text-muted-foreground">⏳ Waiting for buyer to complete payment...</span>
            <span className="font-mono text-primary font-bold ml-2">{formatCountdown(paymentCountdown)}</span>
          </div>
        )}
        {order && order.status === "paid" && isBuyer && (
          <div className="px-4 py-2.5 bg-secondary/60 flex items-center justify-between text-xs border-t border-border">
            <span className="text-muted-foreground">✅ Payment confirmed — waiting for seller to release...</span>
          </div>
        )}
        {order && order.status === "paid" && !isBuyer && (
          <div className="px-4 py-2.5 bg-success/15 flex items-center justify-between text-xs border-t border-success/30">
            <span className="text-success font-medium">Buyer marked payment as sent — verify &amp; release</span>
            <Link href={`/trade/${order.id}`} className="px-3 py-1 bg-success text-white rounded-full font-semibold">Release</Link>
          </div>
        )}

        {/* Warning banner */}
        <div
          onClick={() => setWarningExpanded(!warningExpanded)}
          className="px-4 py-2.5 bg-orange-500/10 border-t border-orange-500/20 flex items-start justify-between cursor-pointer"
        >
          <div className="flex items-start space-x-2 flex-1 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className={`text-xs text-orange-400 ${warningExpanded ? "" : "truncate"}`}>
              ⚠ Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes.
            </p>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 text-orange-400 flex-shrink-0 ml-1 transition-transform ${warningExpanded ? "rotate-90" : ""}`} />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 pb-32 min-h-[calc(100vh-200px)]">
        {loadingMsgs ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-2/3 ml-auto rounded-t-xl rounded-bl-xl" />
            <Skeleton className="h-10 w-1/2 mr-auto rounded-t-xl rounded-br-xl" />
            <Skeleton className="h-10 w-3/4 ml-auto rounded-t-xl rounded-bl-xl" />
          </div>
        ) : (
          <>
            {messages?.length === 0 && (
              <div className="flex justify-center my-4">
                <span className="text-[10px] bg-secondary px-3 py-1 rounded-full text-muted-foreground">
                  Order created. Payment must be completed within {order?.paymentTimeLimit} minutes.
                </span>
              </div>
            )}
            {messages?.map((msg) => {
              const isMe = msg.senderId === user?.id;
              if (msg.type === "admin") {
                return (
                  <div key={msg.id} className="my-3 px-1">
                    <div style={{
                      background: "rgba(0,230,118,0.08)",
                      border: "1px solid rgba(0,230,118,0.25)",
                      borderRadius: "10px",
                      borderLeft: "3px solid #00e676",
                      padding: "10px 14px",
                    }}>
                      <div style={{ color: "#00e676", fontSize: "10px", fontWeight: 600, marginBottom: "4px" }}>
                        ⚖️ Message from Admin
                        {msg.receiverId !== user?.id && (
                          <span style={{ color: "#888", fontWeight: 400, marginLeft: "6px" }}>
                            (sent to {msg.receiverId === order?.buyerId ? "buyer" : "seller"})
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--foreground)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
                        {msg.content}
                      </p>
                      <span className="text-[10px] text-muted-foreground block mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              }
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <span className="text-[10px] bg-secondary px-3 py-1.5 rounded-full text-muted-foreground text-center max-w-xs">{msg.content}</span>
                  </div>
                );
              }
              if (msg.type === "image") {
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-2 py-2 rounded-2xl ${
                      isMe ? "bg-primary/20 rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
                    }`}>
                      <img src={msg.content} alt="Image" style={{ maxWidth: "200px", borderRadius: "8px", display: "block" }} />
                      <span className={`text-[10px] block mt-1 ${isMe ? "text-primary/70 text-right" : "text-muted-foreground"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-card-border rounded-bl-sm"
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <span className={`text-[10px] block mt-1 ${isMe ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--background)",
        borderTop: "1px solid var(--border)",
        boxSizing: "border-box",
        maxWidth: "480px",
        marginLeft: "auto",
        marginRight: "auto",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {/* Image preview strip */}
        {imagePreview && (
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <img src={imagePreview} style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedImage?.name}
              </div>
              <div style={{ fontSize: "11px", color: "#8899aa" }}>
                {((selectedImage?.size ?? 0) / 1024).toFixed(0)} KB
              </div>
            </div>
            <button
              onClick={() => { setSelectedImage(null); setImagePreview(null); }}
              style={{ background: "none", border: "none", color: "#ff4444", fontSize: "22px", cursor: "pointer", flexShrink: 0, lineHeight: 1, padding: "0 4px" }}
            >×</button>
          </div>
        )}

        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "8px 10px",
          boxSizing: "border-box",
          width: "100%",
        }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: "36px", height: "36px",
              minWidth: "36px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, fontSize: "17px",
              opacity: sending ? 0.5 : 1,
            }}
          >
            📎
          </button>

          {/* Text input */}
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={selectedImage ? "Add a caption…" : "Type a message…"}
            disabled={sending}
            style={{
              flex: 1,
              minWidth: 0,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px",
              padding: "9px 14px", color: "#fff",
              fontSize: "13px", outline: "none",
              opacity: sending ? 0.7 : 1,
              boxSizing: "border-box",
            }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!canSend}
            style={{
              width: "38px", height: "38px",
              minWidth: "38px",
              borderRadius: "50%",
              background: canSend ? "#00e5ff" : "rgba(255,255,255,0.12)",
              border: "none",
              cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            {sending ? (
              <div style={{
                width: "15px", height: "15px",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTop: "2px solid #fff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={canSend ? "#1a1a2e" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={canSend ? "#1a1a2e" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}
