import { AppLayout } from "@/components/layout";
import { Copy, ArrowLeft, MessageSquare, Phone, AlertTriangle, X, CheckCircle, Clock } from "lucide-react";
import { useGetOrder, useMarkOrderPaid, useReleaseCrypto, useCancelOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";

const APPEAL_DELAY_MS = 30 * 60 * 1000; // 30 min after paid

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function PaymentMethodDot({ method }: { method: string }) {
  const colors: Record<string, string> = {
    "Tele Birr": "bg-red-500", "CBE": "bg-blue-600", "Awash Bank": "bg-yellow-500",
    "Abyssinia Bank": "bg-green-600", "Dashen Bank": "bg-purple-600",
  };
  const color = colors[method] ?? "bg-primary";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />;
}

export default function TradePage() {
  const { id } = useParams();
  const orderId = Number(id);
  const [, navigate] = useLocation();
  const { data: order, isLoading } = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) } });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markPaid = useMarkOrderPaid();
  const releaseCrypto = useReleaseCrypto();
  const cancelOrder = useCancelOrder();

  const [viewStep, setViewStep] = useState<"order" | "payInstructions">("order");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPlatformNotice, setShowPlatformNotice] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(0);
  const [appealTimeLeft, setAppealTimeLeft] = useState(-1);
  const [acting, setActing] = useState(false);

  const isBuyer = user?.id === order?.buyerId;
  const isSeller = !isBuyer;

  // Payment countdown
  useEffect(() => {
    if (!order || order.status !== "unpaid") return;
    const deadline = new Date(order.createdAt).getTime() + order.paymentTimeLimit * 60 * 1000;
    const tick = () => setPaymentTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  // Appeal unlock countdown (30 min after paidAt)
  useEffect(() => {
    if (!order || order.status !== "paid" || !order.paidAt) return;
    const appealAt = new Date(order.paidAt).getTime() + APPEAL_DELAY_MS;
    const tick = () => setAppealTimeLeft(Math.max(0, Math.floor((appealAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order?.status, order?.paidAt]);

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

  const handleRelease = async () => {
    if (!confirm("Confirm payment received? This will release crypto to the buyer.")) return;
    setActing(true);
    releaseCrypto.mutate({ id: orderId, data: undefined as any }, {
      onSuccess: refreshOrder,
      onError: () => toast({ title: "Failed", variant: "destructive" }),
      onSettled: () => setActing(false),
    });
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setActing(true);
    cancelOrder.mutate({ id: orderId, data: { reason: "User cancelled" } }, {
      onSuccess: () => navigate("/orders"),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
      onSettled: () => setActing(false),
    });
  };

  const handleAppeal = async () => {
    const reason = prompt("Reason for appeal:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description: reason }),
      });
      if (res.ok) { toast({ title: "Appeal raised successfully" }); refreshOrder(); }
      else toast({ title: "Failed to raise appeal", variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
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
    return (
      <AppLayout showNav={false}>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-success/20 border-4 border-success flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <p className="text-4xl font-bold font-mono mb-1">{parseFloat(order.amountUsdt).toFixed(4)}</p>
          <p className="text-lg text-muted-foreground mb-2">USDT</p>
          <p className="text-sm text-muted-foreground mb-8">
            {isBuyer ? "Deposited to your wallet" : "Order completed"}
          </p>
          <p className="text-xs text-muted-foreground mb-8">Rate your counterparty</p>
          <div className="w-full max-w-sm space-y-3">
            <button onClick={() => navigate("/wallet")} className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground">Complete</button>
            <button onClick={() => navigate("/wallet")} className="w-full py-3.5 rounded-xl font-bold border border-border text-foreground">View Assets</button>
          </div>
        </div>
      </AppLayout>
    );
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
            <OrderDetailRow label="KYC Name" value={order.sellerAccountName ?? "—"} onCopy={() => handleCopy(order.sellerAccountName ?? "")} />
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
            <button disabled className="w-full py-3.5 rounded-xl font-bold border border-border text-muted-foreground opacity-50">
              Appeal ({formatTime(appealTimeLeft)})
            </button>
          ) : (
            <button onClick={handleAppeal} className="w-full py-3.5 rounded-xl font-bold border border-orange-500/60 text-orange-400 hover:bg-orange-500/10 transition-colors">
              Appeal — File Dispute
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── SELLER: PAYMENT RECEIVED → RELEASE ───────────────────────────────────
  if (order.status === "paid" && isSeller) {
    return (
      <AppLayout showNav={false}>
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

  // ── PAYMENT INSTRUCTIONS (buyer clicked "Pay") ─────────────────────────────
  if (order.status === "unpaid" && isBuyer && viewStep === "payInstructions") {
    return (
      <AppLayout showNav={false}>
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
                    <span className="font-medium">{order.sellerAccountName ?? "—"}</span>
                    <button onClick={() => handleCopy(order.sellerAccountName ?? "")}><Copy className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone Number</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-mono font-medium">{order.sellerAccountNumber ?? "—"}</span>
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
                  <span className="text-sm font-medium">{order.sellerAccountName ?? "—"}</span>
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
                  <span className="font-mono text-sm font-bold text-primary">{order.sellerAccountNumber ?? "—"}</span>
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
        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <button onClick={() => navigate("/orders")}><ArrowLeft className="w-5 h-5" /></button>
          <div />
          <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-destructive">Cancel Order</button>
        </header>

        <div className="p-4 pb-28 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Order Created</h2>
            <div className="flex items-center space-x-1 mt-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <p className="text-sm font-mono text-primary font-bold">Pay within {formatTime(paymentTimeLeft)}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {counterpartyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold">{counterpartyName}</div>
                <div className="text-xs text-muted-foreground">Seller</div>
              </div>
            </div>
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
            Pay
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
