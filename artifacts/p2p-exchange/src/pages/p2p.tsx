import { AppLayout } from "@/components/layout";
import { Bell, Filter, ShieldCheck, Lock } from "lucide-react";
import { useListAds } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function P2PPage() {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const { data: ads, isLoading } = useListAds({ type });

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4">
        <div className="flex space-x-4 text-lg">
          <span className="text-muted-foreground font-medium">Express</span>
          <span className="text-white font-bold">P2P</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 px-2 py-1 rounded bg-secondary text-xs font-semibold">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span>ETB</span>
          </div>
          <Bell className="w-5 h-5 text-muted-foreground" />
        </div>
      </header>

      <div className="px-4 mb-4">
        <div className="flex p-1 bg-secondary rounded-lg">
          <button
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "buy" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            onClick={() => setType("buy")}
          >
            Buy
          </button>
          <button
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "sell" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            onClick={() => setType("sell")}
          >
            Sell
          </button>
        </div>
      </div>

      <div className="px-4 mb-4 flex space-x-2">
        <button className="flex-1 py-2 px-3 text-xs font-medium rounded border border-border bg-card text-left">
          Amount
        </button>
        <button className="flex-1 py-2 px-3 text-xs font-medium rounded border border-border bg-card text-left">
          Payment
        </button>
        <button className="p-2 rounded border border-border bg-card flex items-center justify-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 space-y-3 pb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-card-border space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        ) : ads?.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
            <p>No Ads Found</p>
          </div>
        ) : (
          ads?.map((ad) => (
            <div key={ad.id} className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    {ad.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium text-sm">{ad.username}</span>
                      {ad.isMerchant && <div className="w-3 h-3 rounded-full bg-warning flex items-center justify-center text-[8px] text-background">✓</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ad.orderCount} orders · {ad.completionRate}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Price</div>
                  <div className="text-lg font-bold font-mono text-primary">{Number(ad.price).toLocaleString()} <span className="text-xs">Br</span></div>
                </div>
              </div>

              <div className="space-y-1 mb-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-mono">{Number(ad.availableAmount).toLocaleString()} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Limit</span>
                  <span className="font-mono">{Number(ad.minLimit).toLocaleString()} - {Number(ad.maxLimit).toLocaleString()} Br</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="flex flex-wrap gap-1 max-w-[60%]">
                  {ad.paymentMethods.slice(0,3).map((method) => (
                    <span key={method} className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] text-muted-foreground font-medium">
                      {method}
                    </span>
                  ))}
                  {ad.paymentMethods.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] text-muted-foreground font-medium">+{ad.paymentMethods.length - 3}</span>
                  )}
                </div>
                <Link href={`/trade/${ad.id}`}>
                  <button className={`px-6 py-2 rounded-md font-semibold text-sm ${type === "buy" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                    {type === "buy" ? "Buy" : "Sell"} USDT
                  </button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
