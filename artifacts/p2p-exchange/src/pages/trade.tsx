import { AppLayout } from "@/components/layout";
import { MessageSquare, MoreVertical, Copy } from "lucide-react";
import { useGetOrder, useMarkOrderPaid, useReleaseCrypto, useCancelOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function TradePage() {
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading } = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) } });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const markPaid = useMarkOrderPaid();
  const releaseCrypto = useReleaseCrypto();
  const cancelOrder = useCancelOrder();

  if (isLoading || !order) {
    return <AppLayout showNav={false}><div className="p-4 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  const isBuyer = user?.id === order.buyerId;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleAction = (action: 'markPaid' | 'release' | 'cancel') => {
    const opts = {
      onSuccess: () => {
        toast({ title: "Action successful" });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      }
    };
    if (action === 'markPaid') markPaid.mutate({ id: orderId, data: undefined as any }, opts);
    if (action === 'release') releaseCrypto.mutate({ id: orderId, data: undefined as any }, opts);
    if (action === 'cancel') {
      if (confirm("Are you sure you want to cancel this order?")) {
        cancelOrder.mutate({ id: orderId, data: { reason: "User cancelled" } }, opts);
      }
    }
  };

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center justify-between p-4 border-b border-border bg-background z-10 sticky top-0">
        <div className="flex items-center space-x-3">
          <Link href="/orders" className="text-muted-foreground">←</Link>
          <div className="font-bold">{isBuyer ? "Buy" : "Sell"} USDT</div>
        </div>
        <div className="flex space-x-4">
          <Link href={`/chat/${order.id}`} className="relative">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            {order.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-warning rounded-full border border-background"></span>}
          </Link>
        </div>
      </header>

      <div className="p-4 space-y-4 pb-24">
        {order.status === "completed" && (
          <div className="text-center py-6 border-b border-border">
            <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">✓</div>
            <h2 className="text-2xl font-bold">Order Completed</h2>
            <p className="text-muted-foreground text-sm mt-1">Successfully {isBuyer ? "bought" : "sold"} {Number(order.amountUsdt).toLocaleString()} USDT</p>
          </div>
        )}

        <div className="bg-card border border-card-border p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <div className="text-sm font-medium text-muted-foreground">Order Status</div>
            <div className="text-sm font-bold uppercase text-primary">{order.status}</div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="text-xl font-bold font-mono text-primary">{Number(order.amountEtb).toLocaleString()} <span className="text-sm">ETB</span></span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-sm font-mono">{Number(order.price).toLocaleString()} ETB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Crypto Amount</span>
            <span className="text-sm font-mono font-medium">{Number(order.amountUsdt).toLocaleString()} USDT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Order Number</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-mono text-muted-foreground">{order.id}</span>
              <button onClick={() => handleCopy(String(order.id))}><Copy className="w-3 h-3 text-muted-foreground" /></button>
            </div>
          </div>
        </div>

        {isBuyer && order.status === "unpaid" && (
          <div className="bg-card border border-card-border p-4 rounded-xl space-y-4">
            <h3 className="font-semibold text-sm">Payment Details</h3>
            <div className="bg-secondary/50 p-3 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Method</span>
                <span className="text-sm font-medium">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Account Name</span>
                <span className="text-sm font-medium">{order.sellerAccountName || 'Loading...'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Account Number</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-mono font-bold text-primary">{order.sellerAccountNumber || 'Loading...'}</span>
                  {order.sellerAccountNumber && <button onClick={() => handleCopy(order.sellerAccountNumber!)}><Copy className="w-4 h-4 text-muted-foreground hover:text-primary" /></button>}
                </div>
              </div>
            </div>
            <p className="text-xs text-warning leading-relaxed">
              Please transfer the exact amount of <span className="font-bold">{Number(order.amountEtb).toLocaleString()} ETB</span> using {order.paymentMethod}. Do NOT include "crypto", "USDT", or any related words in the payment remarks.
            </p>
          </div>
        )}

      </div>

      {order.status === "unpaid" && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto flex space-x-3">
          <button onClick={() => handleAction('cancel')} className="flex-1 py-3 rounded-lg font-semibold bg-secondary text-foreground">Cancel</button>
          {isBuyer && (
            <button onClick={() => handleAction('markPaid')} className="flex-1 py-3 rounded-lg font-semibold bg-primary text-background">Transferred, Notify Seller</button>
          )}
        </div>
      )}

      {order.status === "paid" && isSeller && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
           <button onClick={() => handleAction('release')} className="w-full py-3 rounded-lg font-semibold bg-success text-success-foreground">Payment Received, Release Crypto</button>
        </div>
      )}
    </AppLayout>
  );
}