import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, ShoppingCart, Tag, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useGetWallet } from "@workspace/api-client-react";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

type TxType = "all" | "deposit" | "withdraw" | "p2p_buy" | "p2p_sell" | "internal_send" | "internal_receive";

const FILTERS: { label: string; value: TxType }[] = [
  { label: "All", value: "all" },
  { label: "Deposit", value: "deposit" },
  { label: "Withdraw", value: "withdraw" },
  { label: "P2P Buy", value: "p2p_buy" },
  { label: "P2P Sell", value: "p2p_sell" },
  { label: "Sent", value: "internal_send" },
  { label: "Received", value: "internal_receive" },
];

function txIcon(type: string) {
  switch (type) {
    case "deposit": return <ArrowDownLeft className="w-4 h-4" />;
    case "withdraw": return <ArrowUpRight className="w-4 h-4" />;
    case "p2p_buy": return <ShoppingCart className="w-4 h-4" />;
    case "p2p_sell": return <Tag className="w-4 h-4" />;
    case "internal_send": return <Send className="w-4 h-4" />;
    case "internal_receive": return <ArrowDownLeft className="w-4 h-4" />;
    default: return <RefreshCw className="w-4 h-4" />;
  }
}

function txLabel(type: string) {
  switch (type) {
    case "deposit": return "Deposit";
    case "withdraw": return "Withdrawal";
    case "p2p_buy": return "P2P Buy";
    case "p2p_sell": return "P2P Sell";
    case "internal_send": return "Sent (Internal)";
    case "internal_receive": return "Received (Internal)";
    default: return type;
  }
}

function txColors(type: string): { bg: string; text: string } {
  switch (type) {
    case "deposit":
    case "p2p_sell":
    case "internal_receive":
      return { bg: "rgba(0,212,255,0.12)", text: "#00d4ff" };
    case "withdraw":
    case "p2p_buy":
    case "internal_send":
      return { bg: "rgba(255,107,107,0.12)", text: "#ff6b6b" };
    default:
      return { bg: "rgba(255,255,255,0.08)", text: "#aaa" };
  }
}

function isCredit(type: string) {
  return ["deposit", "p2p_sell", "internal_receive"].includes(type);
}

function statusBadge(status: string) {
  if (status === "completed") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">Completed</span>;
  if (status === "pending") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">Pending</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Failed</span>;
}

function formatDate(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function WalletUsdtPage() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<TxType>("all");

  const { data: wallet } = useGetWallet();

  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ["wallet-transactions"],
    queryFn: () =>
      fetch("/api/wallet/transactions?limit=100", {
        headers: { Authorization: `Bearer ${getToken()}` },
      }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const filtered = filter === "all" ? transactions : transactions.filter((t: any) => t.type === filter);

  return (
    <AppLayout>
      <header className="flex items-center gap-3 p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={() => navigate("/wallet")} className="p-1 hover:bg-secondary/50 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">USDT</h1>
          <p className="text-xs text-muted-foreground">Tether US</p>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-primary">
            {Number(wallet?.availableBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </div>
          <div className="text-xs text-muted-foreground">Available USDT</div>
        </div>
      </header>

      {/* Balance summary card */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl bg-gradient-to-br from-[#26A17B]/20 to-[#00d4ff]/10 border border-[#26A17B]/30 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#26A17B]/20 flex items-center justify-center text-xl font-bold text-[#26A17B]">₮</div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Total Balance</div>
            <div className="font-mono font-bold text-2xl">
              {Number(wallet?.totalBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              <span className="text-sm font-normal text-muted-foreground ml-1">USDT</span>
            </div>
            {Number(wallet?.frozenBalance ?? 0) > 0 && (
              <div className="text-xs text-warning/80 mt-0.5">
                🔒 {Number(wallet?.frozenBalance).toFixed(4)} frozen in orders
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.value
                  ? "bg-primary text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Transactions {filtered.length > 0 && `(${filtered.length})`}
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-card-border">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">No transactions yet</p>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mt-2 text-xs text-primary underline">
                Show all
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx: any) => {
              const colors = txColors(tx.type);
              const credit = isCredit(tx.type);
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-card-border hover:bg-card/80 transition-colors">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{txLabel(tx.type)}</span>
                      {statusBadge(tx.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatDate(tx.createdAt)}
                    </div>
                    {tx.txid && (
                      <div className="text-[10px] text-muted-foreground/60 font-mono truncate mt-0.5">
                        {tx.txid.slice(0, 20)}…
                      </div>
                    )}
                    {tx.note && (
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{tx.note}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className="font-mono font-bold text-sm"
                      style={{ color: colors.text }}
                    >
                      {credit ? "+" : "−"}{Number(tx.amount).toFixed(4)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">USDT</div>
                    {tx.fee && Number(tx.fee) > 0 && (
                      <div className="text-[10px] text-muted-foreground/60">
                        fee {Number(tx.fee).toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
