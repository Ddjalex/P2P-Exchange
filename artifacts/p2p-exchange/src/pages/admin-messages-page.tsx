import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { MessageSquare } from "lucide-react";

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);

  useEffect(() => {
    adminGet<any[]>("/messages/conversations").then(setConversations).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewConversation = async (orderId: number) => {
    setSelected(orderId);
    setMsgLoading(true);
    adminGet<any[]>(`/messages/orders/${orderId}`).then(setMessages).catch(() => {}).finally(() => setMsgLoading(false));
  };

  return (
    <AdminGuard>
      <AdminLayout title="Messages">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-[calc(100vh-160px)]">
          {/* Conversation list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border font-semibold text-sm">Conversations ({conversations.length})</div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="p-4 border-b border-border/50"><div className="h-10 bg-secondary rounded animate-pulse" /></div>)
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No conversations</div>
              ) : conversations.map(c => (
                <button key={c.orderId} onClick={() => viewConversation(c.orderId)}
                  className={`w-full text-left p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors ${selected === c.orderId ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Order #{c.orderId}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'completed' ? 'bg-success/20 text-success' : c.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-warning/20 text-warning'}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.buyerUsername} ↔ {c.sellerUsername}</div>
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3 mr-1" />{c.messageCount} messages
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message viewer */}
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border font-semibold text-sm">
              {selected ? `Order #${selected} — Chat History` : 'Select a conversation'}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!selected ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              ) : msgLoading ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No messages in this order</div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.type === 'system' ? 'justify-center' : 'items-start space-x-2'}`}>
                  {m.type === 'system' ? (
                    <div className="px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs italic">{m.content}</div>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {m.senderUsername?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-0.5">{m.senderUsername} · {new Date(m.createdAt).toLocaleTimeString()}</div>
                        <div className="px-3 py-2 bg-secondary rounded-xl rounded-tl-none text-sm max-w-[280px]">{m.content}</div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border">
              <div className="text-xs text-muted-foreground text-center">Read-only view — admin cannot send messages</div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
