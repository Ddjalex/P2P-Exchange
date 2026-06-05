import { AppLayout } from "@/components/layout";
import { ArrowLeft, Send, AlertTriangle, ChevronRight, Paperclip } from "lucide-react";
import { useGetMessages, useSendMessage, useGetOrder, getGetMessagesQueryKey } from "@workspace/api-client-react";
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
  const { data: messages, isLoading: loadingMsgs } = useGetMessages(orderId, { query: { enabled: !!orderId, queryKey: getGetMessagesQueryKey(orderId), refetchInterval: 3000, refetchIntervalInBackground: false } });
  const { data: order } = useGetOrder(orderId, { query: { enabled: !!orderId, refetchInterval: 5000 } });
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [warningExpanded, setWarningExpanded] = useState(false);
  const [paymentCountdown, setPaymentCountdown] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const token = localStorage.getItem("p2p_token");
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`/api/messages/${orderId}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(orderId) });
    } catch {
      toast({ title: "Failed to send image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage.mutate({ data: { content, type: "text" } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(orderId) });
      }
    });
  };

  const isBuyer = user?.id === order?.buyerId;
  const counterpartyName = isBuyer ? order?.sellerUsername : order?.buyerUsername;
  const counterpartyId = order ? (isBuyer ? order.sellerId : order.buyerId) : null;

  // Live online status for counterparty
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

        {/* Status bar */}
        {order && order.status === "unpaid" && (
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
        {order && order.status === "paid" && isBuyer && (
          <div className="px-4 py-2.5 bg-secondary/60 flex items-center justify-between text-xs border-t border-border">
            <span className="text-muted-foreground">Waiting for seller to release crypto...</span>
          </div>
        )}
        {order && order.status === "paid" && !isBuyer && (
          <div className="px-4 py-2.5 bg-secondary/60 flex items-center justify-between text-xs border-t border-border">
            <span className="text-muted-foreground">Buyer marked payment as sent</span>
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
            <p className={`text-xs text-orange-400 ${warningExpanded ? '' : 'truncate'}`}>
              ⚠ Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes.
            </p>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 text-orange-400 flex-shrink-0 ml-1 transition-transform ${warningExpanded ? 'rotate-90' : ''}`} />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 pb-24 min-h-[calc(100vh-200px)]">
        {loadingMsgs ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-2/3 ml-auto rounded-t-xl rounded-bl-xl" />
            <Skeleton className="h-10 w-1/2 mr-auto rounded-t-xl rounded-br-xl" />
            <Skeleton className="h-10 w-3/4 ml-auto rounded-t-xl rounded-bl-xl" />
          </div>
        ) : (
          <>
            {/* Auto-reply / order created system message indicator */}
            {messages?.length === 0 && (
              <div className="flex justify-center my-4">
                <span className="text-[10px] bg-secondary px-3 py-1 rounded-full text-muted-foreground">
                  Order created. Payment must be completed within {order?.paymentTimeLimit} minutes.
                </span>
              </div>
            )}
            {messages?.map((msg) => {
              const isMe = msg.senderId === user?.id;
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
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto" style={{ padding: "12px 16px 12px 12px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2.5 bg-secondary text-muted-foreground rounded-full disabled:opacity-50 flex-shrink-0 hover:bg-secondary/80 transition-colors"
          >
            {uploadingImage ? (
              <span className="w-4 h-4 block border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your chat here."
            className="flex-1 min-w-0 bg-card border border-border rounded-full px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <button type="submit" disabled={!content.trim() || sendMessage.isPending}
            className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-opacity flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
