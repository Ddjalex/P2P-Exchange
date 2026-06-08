import { AppLayout } from "@/components/layout";
import { Search, MessageSquare } from "lucide-react";
import { useListConversations } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

function formatChatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  }
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending:          { label: "Pending",    cls: "bg-yellow-500/20 text-yellow-400" },
  payment_sent:     { label: "Paid",       cls: "bg-blue-500/20 text-blue-400" },
  completed:        { label: "Completed",  cls: "bg-green-500/20 text-green-400" },
  cancelled:        { label: "Cancelled",  cls: "bg-muted/40 text-muted-foreground" },
  disputed:         { label: "Disputed",   cls: "bg-red-500/20 text-red-400" },
  appeal:           { label: "Appeal",     cls: "bg-orange-500/20 text-orange-400" },
};

export default function ChatPage() {
  const [search, setSearch] = useState("");
  const { data: conversations, isLoading } = useListConversations();

  const filtered = conversations?.filter(conv =>
    !search || conv.traderUsername.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">ME</div>
          <h1 className="font-bold text-xl">P2P Message</h1>
        </div>
      </header>

      <div className="p-4">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by nickname"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center p-3 space-x-3">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : !filtered?.length ? (
            <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p>{search ? "No results found" : "No messages yet"}</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const statusInfo = STATUS_STYLE[conv.orderStatus] ?? { label: conv.orderStatus, cls: "bg-muted/40 text-muted-foreground" };
              const isBuyer = (conv as any).isBuyer;
              const amount = (conv as any).amount;
              return (
                <Link key={conv.orderId} href={`/chat/${conv.orderId}`} className="flex items-center p-3 hover:bg-secondary/50 rounded-xl transition-colors">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-bold relative">
                    {conv.traderUsername.slice(0, 2).toUpperCase()}
                    {conv.isMerchant && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-warning flex items-center justify-center text-[8px] text-background border-2 border-background">✓</div>
                    )}
                  </div>
                  <div className="flex-1 ml-3 overflow-hidden">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm truncate">{conv.traderUsername}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${isBuyer ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {isBuyer ? "Buy" : "Sell"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatChatTime(new Date(conv.lastMessageAt))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {amount && <span className="text-xs text-primary font-medium shrink-0">{parseFloat(amount).toFixed(2)} USDT</span>}
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage || "No messages yet"}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] rounded-full bg-warning text-background flex items-center justify-center text-[10px] font-bold shrink-0 ml-1 px-1">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
