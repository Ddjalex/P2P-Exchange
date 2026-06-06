import { AppLayout } from "@/components/layout";
import { Copy, ArrowLeft, MessageSquare, AlertTriangle, X, CheckCircle, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { useGetOrder, useMarkOrderPaid, useReleaseCrypto, useCancelOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";

const APPEAL_DELAY_MS = 30 * 60 * 1000; // 30 min after paid

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function PaymentMethodDot({ method }: { method: string }) {
  const colors: Record<string, string> = {
    "Tele Birr": "bg-red-500", "Telebirr": "bg-red-500", "CBE": "bg-blue-600", "Awash Bank": "bg-yellow-500",
    "Abyssinia Bank": "bg-green-600", "Dashen Bank": "bg-purple-600",
  };
  const color = colors[method] ?? "bg-primary";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />;
}

function CompletedScreen({ order, isBuyer, orderId }: { order: any; isBuyer: boolean; orderId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState<"positive" | "negative" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  const submitFeedback = async () => {
    if (!feedbackType) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("p2p_token");
      const res = await fetch(`/api/orders/${orderId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: feedbackType, comment: comment || undefined }),
      });
      if (res.ok) {
        toast({ title: "Feedback submitted. Thank you!" });
        setFeedbackDone(true);
      } else {
        const data = await res.json();
        toast({ title: data.message || "Failed to submit feedback", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout showNav={false}>
      <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-12">
        {/* Success icon */}
        <div className="w-24 h-24 rounded-full bg-success/20 border-4 border-success flex items-center justify-center mb-6">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <p className="text-4xl font-bold font-mono mb-1">{parseFloat(order.amountUsdt).toFixed(4)}</p>
        <p className="text-lg text-muted-foreground mb-1">USDT</p>
        <p className="text-sm text-muted-foreground mb-8">
          {isBuyer ? "Deposited to your wallet" : "Order completed"}
        </p>

        {/* Feedback section */}
        {!feedbackDone ? (
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 mb-6">
            <p className="text-sm font-semibold text-center mb-4">Rate your counterparty</p>
            <div className="flex space-x-3 mb-4">
              <button
                onClick={() => setFeedbackType("positive")}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl border font-semibold text-sm transition-colors ${feedbackType === "positive" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-success/50"}`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Positive</span>
              </button>
              <button
                onClick={() => setFeedbackType("negative")}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl border font-semibold text-sm transition-colors ${feedbackType === "negative" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:border-destructive/50"}`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Negative</span>
              </button>
            </div>
            {feedbackType && (
              <div className="mb-4">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value.slice(0, 200))}
                  placeholder="Add a comment (optional)..."
                  rows={3}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground"
                />
                <p className="text-[11px] text-muted-foreground text-right mt-1">{comment.length}/200</p>
              </div>
            )}
            <button
              onClick={submitFeedback}
              disabled={!feedbackType || submitting}
              className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-success/10 border border-success/30 rounded-2xl p-4 mb-6 text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-sm font-semibold text-success">Feedback submitted!</p>
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          <button onClick={() => navigate("/wallet")} className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground">
            Complete
          </button>
          <button onClick={() => navigate("/wallet")} className="w-full py-3.5 rounded-xl font-bold border border-border text-foreground">
            View Assets
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

export default function TradePage() {
  const { id } = useParams();
  const orderId = Number(id);
  const [, navigate] = useLocation();
  const { data: order, isLoading } = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId), refetchInterval: 5000, refetchIntervalInBackground: true } });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("p2p_token");

  const markPaid = useMarkOrderPaid();
  const releaseCrypto = useReleaseCrypto();
  const cancelOrder = useCancelOrder();

  const [viewStep, setViewStep] = useState<"order" | "payInstructions">("order");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPlatformNotice, setShowPlatformNotice] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(0);
  const [appealTimeLeft, setAppealTimeLeft] = useState(-1);
  const [acting, setActing] = useState(false);

  // Appeal sheet state
  const [showAppealSheet, setShowAppealSheet] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealDescription, setAppealDescription] = useState('');
  const [appealImages, setAppealImages] = useState<File[]>([]);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealError, setAppealError] = useState('');

  const isBuyer = user?.id === order?.buyerId;
  const isSeller = !isBuyer;

  const sendBrowserNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', vibrate: [100, 50, 100] }))
        .catch(() => {});
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Payment countdown
  useEffect(() => {
    if (!order || order.status !== "unpaid") return;
    const deadline = new Date(order.createdAt).getTime() + order.paymentTimeLimit * 60 * 1000;
    const tick = () => setPaymentTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  // Appeal unlock countdown — uses appealAvailableAt set by backend when buyer marks paid
  useEffect(() => {
    if (!order || order.status !== "paid") return;
    const appealAt = order.appealAvailableAt
      ? new Date(order.appealAvailableAt).getTime()
      : (order.paidAt ? new Date(order.paidAt).getTime() + APPEAL_DELAY_MS : Date.now() + APPEAL_DELAY_MS);
    const tick = () => setAppealTimeLeft(Math.max(0, Math.floor((appealAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order?.status, order?.appealAvailableAt, order?.paidAt]);

  // Platform notice — show once per order when buyer's status becomes paid
  useEffect(() => {
    if (!order || !isBuyer) return;
    if (order.status === "paid") {
      const key = `platform_notice_shown_${orderId}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setShowPlatformNotice(true);
      }
    }
  }, [order?.status, isBuyer, orderId]);

  // Watch for status changes and show live toast + browser notifications
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!order) return;
    const prev = prevStatusRef.current;
    const curr = order.status;
    if (prev && prev !== curr) {
      if (curr === 'paid') {
        toast({ title: '✅ Buyer has marked payment as sent!' });
        if (isSeller) sendBrowserNotification('Payment Received', 'Buyer has marked payment as sent. Please verify and release crypto.');
      }
      if (curr === 'completed') {
        toast({ title: '🎉 Order completed! USDT released to wallet.' });
        sendBrowserNotification('Order Completed 🎉', isBuyer ? 'USDT has been released to your wallet!' : `Order completed. ${Number(order.amountEtb).toLocaleString()} ETB received.`);
      }
      if (curr === 'cancelled') {
        toast({ title: '❌ Order has been cancelled.', variant: 'destructive' });
        sendBrowserNotification('Order Cancelled', 'The order has been cancelled.');
      }
      if (curr === 'appeal') {
        toast({ title: '⚠️ Appeal has been raised on this order.', variant: 'destructive' });
        sendBrowserNotification('Appeal Raised ⚠️', 'An appeal has been submitted on this order. Admin is reviewing.');
      }
    }
    prevStatusRef.current = curr;
  }, [order?.status]);

  const refreshOrder = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
  }, [queryClient, orderId]);

  const handleCopy = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: label ? `${label} copied` : "Copied to clipboard" });
  };

  const handleMarkPaid = async () => {
    setActing(true);
    markPaid.mutate({ id: orderId, data: undefined as any }, {
      onSuccess: () => { refreshOrder(); setViewStep("order"); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
      onSettled: () => setActing(false),
    });
  };

  const handleRelease = () => setShowReleaseDialog(true);

  const doRelease = () => {
    setShowReleaseDialog(false);
    setActing(true);
    releaseCrypto.mutate({ id: orderId, data: undefined as any }, {
      onSuccess: refreshOrder,
      onError: () => toast({ title: "Failed to release", variant: "destructive" }),
      onSettled: () => setActing(false),
    });
  };

  const handleCancel = () => setShowCancelDialog(true);

  const doCancel = () => {
    setShowCancelDialog(false);
    setActing(true);
    cancelOrder.mutate({ id: orderId, data: { reason: "User cancelled" } }, {
      onSuccess: () => navigate("/orders"),
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
      onSettled: () => setActing(false),
    });
  };

  const handleSubmitAppeal = async () => {
    if (!appealReason) { setAppealError('Please select a reason'); return; }
    setAppealLoading(true);
    setAppealError('');
    try {
      const evidenceUrls: string[] = [];
      for (const img of appealImages) {
        const formData = new FormData();
        formData.append('image', img);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          evidenceUrls.push(url);
        }
      }
      const res = await fetch(`/api/orders/${orderId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: appealReason, description: appealDescription, evidenceUrls }),
      });
      const data = await res.json();
      if (!res.ok) { setAppealError(data.message || 'Failed to raise appeal'); return; }
      setShowAppealSheet(false);
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      toast({ title: 'Appeal submitted successfully' });
    } catch {
      setAppealError('Network error. Please try again.');
    } finally {
      setAppealLoading(false);
    }
  };

  if (isLoading || !order) {
    return (
      <AppLayout showNav={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  // ── COMPLETE SCREEN ────────────────────────────────────────────────────────
  if (order.status === "completed") {
    return <CompletedScreen order={order} isBuyer={isBuyer} orderId={orderId} />;
  }

  // ── CANCELLED SCREEN ───────────────────────────────────────────────────────
  if (order.status === "cancelled") {
    return (
      <AppLayout showNav={false}>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 text-4xl">✕</div>
          <h2 className="text-2xl font-bold mb-2">Order Cancelled</h2>
          {order.cancelReason && <p className="text-muted-foreground text-sm mb-1">Reason: {order.cancelReason}</p>}
          <button onClick={() => navigate("/orders")} className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold">Back to Orders</button>
        </div>
      </AppLayout>
    );
  }

  // ── APPEAL SCREEN ──────────────────────────────────────────────────────────
  if (order.status === "appeal") {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold">Under Appeal</span>
          <Link href={`/chat/${order.id}`}><MessageSquare className="w-5 h-5 text-primary" /></Link>
        </header>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Appeal Under Review</h2>
          <p className="text-muted-foreground text-sm">Admin is reviewing your appeal. USDT is frozen until resolved.</p>
          <div className="mt-6 bg-card border border-border rounded-xl p-4 text-left space-y-2 text-sm">
            <OrderDetailRow label="Order No." value={`#${order.id}`} onCopy={() => handleCopy(String(order.id), "Order No.")} />
            <OrderDetailRow label="Amount" value={`${Number(order.amountEtb).toLocaleString()} ETB`} />
            <OrderDetailRow label="Quantity" value={`${parseFloat(order.amountUsdt).toFixed(4)} USDT`} />
          </div>
        </div>
      </AppLayout>
    );
  }

  const counterpartyName = isBuyer ? order.sellerUsername : order.buyerUsername;

  // ── WAITING FOR RELEASE (buyer paid) ───────────────────────────────────────
  if (order.status === "paid" && isBuyer) {
    return (
      <AppLayout showNav={false}>
        {showPlatformNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="font-bold text-center text-lg mb-3">Platform Notice</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Follow the guidelines below to trade safely and reduce the risk of asset loss:
              </p>
              <ol className="space-y-2 text-sm text-foreground/80">
                <li>1. Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes.</li>
                <li>2. The crypto in this order has been locked, and your order is securely protected.</li>
              </ol>
              <button onClick={() => setShowPlatformNotice(false)} className="w-full mt-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold">Got It</button>
            </div>
          </div>
        )}

        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-sm">Waiting for Release</span>
          <Link href={`/chat/${order.id}`} className="flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">
            <MessageSquare className="w-3.5 h-3.5" /><span>Chat</span>
          </Link>
        </header>

        <div className="p-4 pb-28 space-y-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Waiting for seller to release</h2>
            <p className="text-sm text-muted-foreground">Waiting for seller to confirm receipt</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{counterpartyName.charAt(0).toUpperCase()}</div>
              <div>
                <div className="font-semibold text-sm">{counterpartyName}</div>
                <div className="text-xs text-muted-foreground">Seller</div>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center px-3 py-1 rounded-full bg-success/15 text-success text-xs font-bold">Buy USDT</div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <OrderDetailRow label="KYC Name" value={order.sellerAccountName || "—"} onCopy={() => handleCopy(order.sellerAccountName ?? "")} />
            <OrderDetailRow label="Amount" value={`${Number(order.amountEtb).toLocaleString()} ETB`} onCopy={() => handleCopy(String(order.amountEtb))} />
            <OrderDetailRow label="Price" value={`${Number(order.price).toLocaleString()} ETB/USDT`} />
            <OrderDetailRow label="Quantity" value={`${parseFloat(order.amountUsdt).toFixed(4)} USDT`} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Payment Method</span>
              <span className="text-sm flex items-center"><PaymentMethodDot method={order.paymentMethod} />{order.paymentMethod}</span>
            </div>
            <OrderDetailRow label="Order No." value={`#${order.id}`} onCopy={() => handleCopy(String(order.id), "Order No.")} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Order Time</span>
              <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
          {appealTimeLeft > 0 ? (
            <button disabled style={{ width: '100%', height: '48px', background: 'transparent', border: '1.5px solid #334455', borderRadius: '24px', color: '#556677', fontSize: '14px', fontWeight: 600 }}>
              Appeal ({formatTime(appealTimeLeft)})
            </button>
          ) : (
            <button onClick={() => { setAppealReason(''); setAppealDescription(''); setAppealImages([]); setAppealError(''); setShowAppealSheet(true); }} style={{ width: '100%', height: '48px', background: 'transparent', border: '1.5px solid #ff8800', borderRadius: '24px', color: '#ff8800', fontSize: '14px', fontWeight: 600 }}>
              Appeal — File Dispute
            </button>
          )}
        </div>

        {/* Appeal bottom sheet */}
        {showAppealSheet && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#16213e', width: '100%', borderRadius: '16px 16px 0 0', padding: '24px 20px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>Raise Appeal</h3>
                <button onClick={() => setShowAppealSheet(false)} style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>

              {appealError && (
                <div style={{ background: '#ff4444', padding: '10px', borderRadius: '8px', marginBottom: '16px', color: '#fff', fontSize: '13px' }}>
                  {appealError}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#8899aa', fontSize: '12px', marginBottom: '8px', display: 'block' }}>SELECT REASON *</label>
                {['I have paid but seller has not released', 'Seller is asking for extra fees', 'Seller is unresponsive', 'I made a wrong payment', 'Other'].map(reason => (
                  <div key={reason} onClick={() => setAppealReason(reason)} style={{ padding: '12px 16px', marginBottom: '8px', borderRadius: '8px', border: appealReason === reason ? '1.5px solid #00e5ff' : '1px solid #334455', background: appealReason === reason ? 'rgba(0,229,255,0.08)' : 'transparent', color: appealReason === reason ? '#00e5ff' : '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: appealReason === reason ? '5px solid #00e5ff' : '2px solid #556677', flexShrink: 0 }} />
                    {reason}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#8899aa', fontSize: '12px', marginBottom: '8px', display: 'block' }}>DESCRIPTION (OPTIONAL)</label>
                <textarea value={appealDescription} onChange={e => setAppealDescription(e.target.value.slice(0, 500))} placeholder="Describe your issue..." maxLength={500} style={{ width: '100%', height: '100px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334455', borderRadius: '8px', color: '#fff', fontSize: '13px', padding: '10px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#8899aa' }}>{appealDescription.length}/500</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#8899aa', fontSize: '12px', marginBottom: '8px', display: 'block' }}>EVIDENCE (UP TO 3 SCREENSHOTS)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {appealImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(img)} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button onClick={() => setAppealImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                  {appealImages.length < 3 && (
                    <label style={{ width: '80px', height: '80px', border: '1.5px dashed #00e5ff', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#00e5ff', fontSize: '11px', gap: '4px' }}>
                      <span style={{ fontSize: '24px' }}>+</span>
                      <span>Upload</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { setAppealError('Image must be under 5MB'); return; }
                        setAppealImages(prev => [...prev, file]);
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#ffaa00', marginBottom: '20px' }}>
                ⚠️ Only raise appeal if you have genuinely paid. False appeals may result in account suspension.
              </div>

              <button disabled={!appealReason || appealLoading} onClick={handleSubmitAppeal} style={{ width: '100%', height: '48px', background: appealReason && !appealLoading ? '#00e5ff' : '#334455', border: 'none', borderRadius: '24px', color: appealReason ? '#1a1a2e' : '#8899aa', fontSize: '15px', fontWeight: 700, cursor: appealReason ? 'pointer' : 'not-allowed' }}>
                {appealLoading ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }

  // ── SELLER: PAYMENT RECEIVED → RELEASE ───────────────────────────────────
  if (order.status === "paid" && isSeller) {
    return (
      <AppLayout showNav={false}>
        {/* Release Confirm Modal */}
        {showReleaseDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-success" />
              </div>
              <h3 className="font-bold text-center text-lg mb-2">Confirm Release</h3>
              <p className="text-sm text-muted-foreground text-center mb-1">
                You are about to release
              </p>
              <p className="text-2xl font-bold font-mono text-primary text-center mb-1">
                {parseFloat(order.amountUsdt).toFixed(4)} USDT
              </p>
              <p className="text-xs text-muted-foreground text-center mb-5">
                to <span className="font-semibold text-foreground">{order.buyerUsername}</span>. This action cannot be undone.
              </p>
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 mb-5 text-xs text-warning text-center">
                ⚠ Only release after you have verified the payment in your bank or wallet.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowReleaseDialog(false)}
                  className="py-3 rounded-xl font-bold border border-border text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={doRelease}
                  disabled={acting}
                  className="py-3 rounded-xl font-bold bg-success text-white disabled:opacity-50"
                >
                  {acting ? "Releasing..." : "Release USDT"}
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-sm">Payment Received</span>
          <Link href={`/chat/${order.id}`} className="flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">
            <MessageSquare className="w-3.5 h-3.5" /><span>Chat</span>
          </Link>
        </header>
        <div className="p-4 pb-28 space-y-4">
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-sm text-warning">
            ⚠ Buyer has marked payment as sent. Please verify you received the payment before releasing.
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <OrderDetailRow label="Amount" value={`${Number(order.amountEtb).toLocaleString()} ETB`} />
            <OrderDetailRow label="Quantity" value={`${parseFloat(order.amountUsdt).toFixed(4)} USDT`} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Payment Method</span>
              <span className="text-sm flex items-center"><PaymentMethodDot method={order.paymentMethod} />{order.paymentMethod}</span>
            </div>
            <OrderDetailRow label="Order No." value={`#${order.id}`} onCopy={() => handleCopy(String(order.id))} />
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
          <button onClick={handleRelease} disabled={acting} className="w-full py-3.5 rounded-xl font-bold bg-success text-white disabled:opacity-50">
            {acting ? "Releasing..." : "Payment Received, Release Crypto"}
          </button>
        </div>
      </AppLayout>
    );
  }

  const CancelDialog = () => showCancelDialog ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
          <X className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="font-bold text-center text-lg mb-2">Cancel Order?</h3>
        <p className="text-sm text-muted-foreground text-center mb-5">
          Are you sure you want to cancel this order? This cannot be undone.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowCancelDialog(false)} className="py-3 rounded-xl font-bold border border-border text-foreground">
            Keep Order
          </button>
          <button onClick={doCancel} disabled={acting} className="py-3 rounded-xl font-bold bg-destructive text-white disabled:opacity-50">
            {acting ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── PAYMENT INSTRUCTIONS (buyer clicked "Pay") ─────────────────────────────
  if (order.status === "unpaid" && isBuyer && viewStep === "payInstructions") {
    return (
      <AppLayout showNav={false}>
        <CancelDialog />
        {showConfirmDialog && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
            <div className="bg-card border border-border rounded-t-2xl p-6 w-full sm:max-w-[480px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Payment Confirmation</h3>
                <button onClick={() => setShowConfirmDialog(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-warning mb-4">Clicking [Confirm] without making payment may put your account at risk.</p>
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3 mb-5">
                <div className="flex items-center space-x-2">
                  <PaymentMethodDot method={order.paymentMethod} />
                  <span className="text-sm font-medium">{order.paymentMethod}</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold font-mono text-primary">{Number(order.amountEtb).toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground ml-1">ETB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">KYC Name</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">{order.sellerAccountName || "—"}</span>
                    <button onClick={() => handleCopy(order.sellerAccountName ?? "")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone Number</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-mono font-medium">{order.sellerAccountNumber || "—"}</span>
                    <button onClick={() => handleCopy(order.sellerAccountNumber ?? "")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowConfirmDialog(false)} className="py-3 rounded-xl font-bold border border-border text-foreground">No</button>
                <button onClick={handleMarkPaid} disabled={acting} className="py-3 rounded-xl font-bold bg-primary text-primary-foreground disabled:opacity-50">
                  {acting ? "Confirming..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => setViewStep("order")}><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-sm">Payment Instructions</span>
          <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-destructive">Cancel Order</button>
        </header>

        <div className="p-4 pb-28 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">Please pay the seller</h2>
              <p className="text-[11px] text-primary font-mono mt-1">Order will be cancelled in {formatTime(paymentTimeLeft)}</p>
            </div>
            <Link href={`/chat/${order.id}`} className="flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">
              <MessageSquare className="w-3.5 h-3.5" /><span>Chat</span>
            </Link>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">1</div>
              <div className="flex-1 flex justify-between items-center">
                <span className="text-sm font-semibold">Transfer Now</span>
                <span className="text-xs text-muted-foreground">{order.paymentMethod}</span>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">KYC Name</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-medium">{order.sellerAccountName || "—"}</span>
                  <button onClick={() => handleCopy(order.sellerAccountName ?? "", "Name")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Amount</span>
                <div className="flex items-center space-x-1">
                  <span className="text-base font-bold font-mono">{Number(order.amountEtb).toLocaleString()} ETB</span>
                  <button onClick={() => handleCopy(order.amountEtb, "Amount")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Phone / Account</span>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-sm font-bold text-primary">{order.sellerAccountNumber || "—"}</span>
                  <button onClick={() => handleCopy(order.sellerAccountNumber ?? "", "Account")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">2</div>
              <span className="text-sm text-muted-foreground">After paying, click the button below to notify the seller</span>
            </div>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">P2P Trading Tips</p>
            <p className="text-xs text-muted-foreground leading-relaxed">1. Always communicate via the platform. Do not use third-party platforms.</p>
            <p className="text-xs text-muted-foreground leading-relaxed">2. If you have already paid, do not cancel the order. If the other party asks to cancel, please file an appeal.</p>
          </div>

          <p className="text-xs text-muted-foreground text-center">Click the button below to notify the seller to release the crypto</p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
          <button onClick={() => setShowConfirmDialog(true)} className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground">
            I have paid
          </button>
        </div>
      </AppLayout>
    );
  }

  // ── ORDER CREATED (buyer, unpaid) ──────────────────────────────────────────
  if (order.status === "unpaid" && isBuyer) {
    return (
      <AppLayout showNav={false}>
        <CancelDialog />
        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
          <div />
          <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-destructive">Cancel Order</button>
        </header>

        <div className="p-4 pb-28 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Order Created</h2>
            <p className="text-sm text-muted-foreground mt-1">Review the order details below</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <button className="flex items-center space-x-3 text-left" onClick={() => navigate(`/trader/${order.sellerId}`)}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {counterpartyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold">{counterpartyName}</div>
                <div className="text-xs text-muted-foreground">Seller</div>
              </div>
            </button>
            <Link href={`/chat/${order.id}`} className="flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">
              <MessageSquare className="w-3.5 h-3.5" /><span>Chat</span>
            </Link>
          </div>

          <div className="inline-flex items-center px-3 py-1 rounded-full bg-success/15 text-success text-xs font-bold">Buy USDT</div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <OrderDetailRow label="Amount" value={`${Number(order.amountEtb).toLocaleString()} ETB`} onCopy={() => handleCopy(order.amountEtb, "Amount")} />
            <OrderDetailRow label="Price" value={`${Number(order.price).toLocaleString()} ETB/USDT`} />
            <OrderDetailRow label="Quantity" value={`${parseFloat(order.amountUsdt).toFixed(4)} USDT`} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Payment Method</span>
              <span className="text-sm flex items-center"><PaymentMethodDot method={order.paymentMethod} />{order.paymentMethod}</span>
            </div>
            <OrderDetailRow label="Order No." value={`#${order.id}`} onCopy={() => handleCopy(String(order.id), "Order No.")} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Order Time</span>
              <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
          <button onClick={() => setViewStep("payInstructions")} className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground">
            Confirm
          </button>
        </div>
      </AppLayout>
    );
  }

  // ── SELLER: ORDER CREATED (waiting for buyer to pay) ──────────────────────
  return (
    <AppLayout showNav={false}>
      <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
        <span className="font-bold text-sm">Sell USDT</span>
        <Link href={`/chat/${order.id}`} className="flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">
          <MessageSquare className="w-3.5 h-3.5" /><span>Chat</span>
        </Link>
      </header>
      <div className="p-4 pb-10 space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">Order Created</h2>
          <p className="text-sm text-muted-foreground">Waiting for buyer to complete payment</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <OrderDetailRow label="Amount" value={`${Number(order.amountEtb).toLocaleString()} ETB`} />
          <OrderDetailRow label="Quantity" value={`${parseFloat(order.amountUsdt).toFixed(4)} USDT`} />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Payment Method</span>
            <span className="text-sm flex items-center"><PaymentMethodDot method={order.paymentMethod} />{order.paymentMethod}</span>
          </div>
          <OrderDetailRow label="Order No." value={`#${order.id}`} onCopy={() => handleCopy(String(order.id))} />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Order Time</span>
            <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
          ⚠️ Please do not use third-party platforms for communication, as external chat history cannot be used as valid evidence in order disputes.
        </div>
      </div>
    </AppLayout>
  );
}

function OrderDetailRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center space-x-1.5">
        <span className="text-sm font-medium">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-primary transition-colors">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
