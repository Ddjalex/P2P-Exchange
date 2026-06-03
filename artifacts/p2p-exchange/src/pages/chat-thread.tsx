import { AppLayout } from "@/components/layout";
import { ArrowLeft, Send, Image as ImageIcon } from "lucide-react";
import { useGetMessages, useSendMessage, useGetOrder, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function ChatThreadPage() {
  const { orderId: id } = useParams();
  const orderId = Number(id);
  const { data: messages, isLoading: loadingMsgs } = useGetMessages(orderId, { query: { enabled: !!orderId, queryKey: getGetMessagesQueryKey(orderId) } });
  const { data: order } = useGetOrder(orderId, { query: { enabled: !!orderId } });
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage.mutate({ data: { content, type: "text" } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(orderId) });
      }
    });
  };

  return (
    <AppLayout showNav={false}>
      <header className="flex flex-col border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href="/chat" className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-bold text-sm">{order?.buyerId === user?.id ? order?.sellerUsername : order?.buyerUsername}</h1>
              <span className="text-xs text-muted-foreground">Order: {order?.id}</span>
            </div>
          </div>
        </div>
        {order && (
          <div className="px-4 py-2 bg-secondary/50 flex justify-between items-center text-xs">
            <div>
              <span className="text-muted-foreground mr-2">Amount</span>
              <span className="font-mono font-bold text-primary">{Number(order.amountEtb).toLocaleString()} ETB</span>
            </div>
            <Link href={`/trade/${order.id}`} className="text-primary font-medium hover:underline">View Order</Link>
          </div>
        )}
      </header>

      <div className="p-4 space-y-4 pb-20 min-h-[calc(100vh-140px)] flex flex-col justify-end">
        {loadingMsgs ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3 ml-auto rounded-t-xl rounded-bl-xl" />
            <Skeleton className="h-10 w-1/2 mr-auto rounded-t-xl rounded-br-xl" />
            <Skeleton className="h-10 w-3/4 ml-auto rounded-t-xl rounded-bl-xl" />
          </div>
        ) : (
          messages?.map((msg) => {
            const isMe = msg.senderId === user?.id;
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="text-[10px] bg-secondary px-3 py-1 rounded-full text-muted-foreground">{msg.content}</span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                  isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-card-border rounded-bl-sm"
                }`}>
                  <p>{msg.content}</p>
                  <span className={`text-[10px] block mt-1 ${isMe ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors"><ImageIcon className="w-5 h-5" /></button>
          <input 
            type="text" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..." 
            className="flex-1 bg-card border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="submit" disabled={!content.trim() || sendMessage.isPending} className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </AppLayout>
  );
}