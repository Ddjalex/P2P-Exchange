import { AppLayout } from "@/components/layout";
import { Plus, Search, MessageSquare } from "lucide-react";
import { useListConversations } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function ChatPage() {
  const [tab, setTab] = useState<"all" | "for_you">("all");
  const { data: conversations, isLoading } = useListConversations();

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">ME</div>
          <h1 className="font-bold text-xl">P2P Message</h1>
        </div>
        <Plus className="w-5 h-5 text-muted-foreground" />
      </header>

      <div className="p-4">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by nickname" 
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex space-x-6 border-b border-border mb-4">
          {["All", "For You"].map((t) => {
            const val = t.toLowerCase().replace(" ", "_");
            return (
              <button
                key={t}
                onClick={() => setTab(val as any)}
                className={`pb-2 text-sm font-medium ${tab === val ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
              >
                {t}
              </button>
            );
          })}
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
          ) : conversations?.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p>No messages yet</p>
            </div>
          ) : (
            conversations?.map((conv) => (
              <Link key={conv.orderId} href={`/chat/${conv.orderId}`} className="flex items-center p-3 hover:bg-secondary/50 rounded-xl transition-colors">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-bold relative">
                  {conv.traderUsername.slice(0, 2).toUpperCase()}
                  {conv.isMerchant && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-warning flex items-center justify-center text-[8px] text-background border-2 border-background">✓</div>}
                </div>
                <div className="flex-1 ml-3 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm truncate">{conv.traderUsername}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground truncate mr-2">{conv.lastMessage}</p>
                    {conv.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-warning text-background flex items-center justify-center text-[10px] font-bold shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}