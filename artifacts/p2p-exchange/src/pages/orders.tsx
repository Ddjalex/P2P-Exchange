import { AppLayout } from "@/components/layout";
import { MessageSquare } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  unpaid:    { label: "Unpaid",       cls: "bg-yellow-500/15 text-yellow-400" },
  paid:      { label: "Paid",         cls: "bg-primary/15 text-primary" },
  completed: { label: "Completed",    cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled",    cls: "bg-muted text-muted-foreground" },
  appeal:    { label: "Under Appeal", cls: "bg-destructive/15 text-destructive" },
};

type MainTab = "open" | "ended";
const OPEN_FILTERS  = ["all", "unpaid", "paid", "appeal"] as const;
const ENDED_FILTERS = ["all", "completed", "cancelled"] as const;

export default function OrdersPage() {
  const [mainTab, setMainTab] = useState<MainTab>("open");
  const [openFilter, setOpenFilter] = useState<string>("all");
  const [endedFilter, setEndedFilter] = useState<string>("all");
  const { user } = useAuth();

  const tab = mainTab === "open" ? "ongoing" : "fulfilled";
  const statusFilter = mainTab === "open"
    ? (openFilter !== "all" ? openFilter : undefined)
    : (endedFilter !== "all" ? endedFilter : undefined);

  const { data: orders, isLoading } = useListOrders({ tab, status: statusFilter } as any);

  const subFilters = mainTab === "open" ? OPEN_FILTERS : ENDED_FILTERS;
  const activeFilter = mainTab === "open" ? openFilter : endedFilter;
  const setFilter = mainTab === "open" ? setOpenFilter : setEndedFilter;

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="font-bold text-xl">Orders</h1>
      </header>

      {/* Main tabs */}
      <div className="flex border-b border-border bg-background">
        {([["open", "Open Orders"], ["ended", "Ended"]] as [MainTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setMainTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${mainTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sub-filters */}
      <div className="flex space-x-2 px-4 py-2.5 border-b border-border overflow-x-auto">
        {subFilters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === f ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All" : f === "appeal" ? "Under Appeal" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 pb-24">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
        ) : orders?.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">No orders found</div>
        ) : (
          orders?.map(order => {
            const isBuyer = user?.id === order.buyerId;
            const counterparty = isBuyer ? order.sellerUsername : order.buyerUsername;
            const badge = STATUS_BADGES[order.status] ?? STATUS_BADGES.cancelled;
            return (
              <Link key={order.id} href={`/trade/${order.id}`}
                className="block bg-card border border-card-border p-4 rounded-xl active:bg-secondary/50 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${isBuyer ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {isBuyer ? "Buy" : "Sell"} USDT
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    <span className="text-muted-foreground text-xs">›</span>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <span className="font-mono text-sm font-bold">Br {Number(order.amountEtb).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Price</span>
                    <span className="font-mono text-xs">Br {Number(order.price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Quantity</span>
                    <span className="font-mono text-xs text-primary font-medium">{Number(order.amountUsdt).toFixed(4)} USDT</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold">
                      {counterparty.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-muted-foreground">{counterparty}</span>
                  </div>
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
