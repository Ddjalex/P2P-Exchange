import { AppLayout } from "@/components/layout";
import { Download, Search, Filter } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function OrdersPage() {
  const [tab, setTab] = useState<"ongoing" | "fulfilled">("ongoing");
  const { data: orders, isLoading } = useListOrders({ tab });

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="font-bold text-xl">Order History</h1>
        <div className="flex space-x-4">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Filter className="w-5 h-5 text-muted-foreground" />
        </div>
      </header>

      <div className="flex border-b border-border">
        {["ongoing", "fulfilled"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
        ) : orders?.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No orders found
          </div>
        ) : (
          orders?.map(order => (
            <Link key={order.id} href={`/trade/${order.id}`} className="block bg-card border border-card-border p-4 rounded-xl active:bg-secondary/50 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-bold uppercase ${order.buyerId === order.id ? 'text-primary' : 'text-destructive'}`}>
                    {order.buyerId === order.id ? 'Buy' : 'Sell'}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">USDT</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-secondary capitalize text-muted-foreground font-medium">
                  {order.status}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="font-mono text-sm font-bold">{Number(order.amountEtb).toLocaleString()} Br</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Price</span>
                  <span className="font-mono text-xs">{Number(order.price).toLocaleString()} Br</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Crypto Amount</span>
                  <span className="font-mono text-xs text-primary font-medium">{Number(order.amountUsdt).toLocaleString()} USDT</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-foreground">
                    {(order.buyerId === order.id ? order.sellerUsername : order.buyerUsername).slice(0, 2).toUpperCase()}
                  </div>
                  <span>{order.buyerId === order.id ? order.sellerUsername : order.buyerUsername}</span>
                </div>
                <div>{new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </AppLayout>
  );
}