import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { triggerNotification } from "@/helpers/notifications";

const TOKEN_KEY = "p2p_token";

const KYC_MESSAGES: Record<string, { title: string; description: string; variant?: "default" | "destructive" }> = {
  verified: {
    title: "🎉 KYC Approved!",
    description: "Your identity has been verified. You can now trade on Xendrx.",
    variant: "default",
  },
  rejected: {
    title: "KYC Rejected",
    description: "Your KYC submission was rejected. Please check your wallet for details and resubmit.",
    variant: "destructive",
  },
  more_info_required: {
    title: "More Information Needed",
    description: "The admin has requested additional information for your KYC. Please update your submission.",
    variant: "destructive",
  },
};

export function useSse() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    let closed = false;

    function connect() {
      if (closed) return;

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      const url = `/api/sse/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      // ── KYC status change ──────────────────────────────────────────────────
      es.addEventListener("kyc_update", async (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { status: string; rejectionReason?: string };
          const msg = KYC_MESSAGES[data.status];
          if (msg) {
            toast({
              title: msg.title,
              description: data.rejectionReason ? `${msg.description} Reason: ${data.rejectionReason}` : msg.description,
              variant: msg.variant,
            });
          }
          await refreshUser();
        } catch {}
      });

      // ── Order status changed ───────────────────────────────────────────────
      es.addEventListener("order_update", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { orderId: number; status: string; type: string };

          // Invalidate all order-related caches immediately
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          queryClient.invalidateQueries({ queryKey: ["badge-orders"] });
          queryClient.invalidateQueries({ queryKey: ["notif-count"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });

          if (data.orderId) {
            queryClient.invalidateQueries({ queryKey: [`/api/orders/${data.orderId}`] });
          }

          if (data.type === "order_created") {
            triggerNotification("order");
            toast({ title: "🔔 New Order", description: "A new order has been created." });
          } else if (data.type === "payment_sent") {
            triggerNotification("order");
            toast({ title: "💰 Payment Marked", description: "The buyer has marked payment as sent." });
          } else if (data.type === "order_completed") {
            triggerNotification("order");
            toast({ title: "✅ Order Completed", description: "The order has been completed successfully." });
          } else if (data.type === "order_cancelled") {
            toast({ title: "❌ Order Cancelled", description: "An order has been cancelled.", variant: "destructive" });
          }
        } catch {}
      });

      // ── New chat message ───────────────────────────────────────────────────
      es.addEventListener("new_message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { orderId: number; senderUsername: string };

          queryClient.invalidateQueries({ queryKey: ["badge-chat"] });
          queryClient.invalidateQueries({ queryKey: ["notif-count"] });

          if (data.orderId) {
            queryClient.invalidateQueries({ queryKey: [`/api/messages/${data.orderId}`] });
          }

          triggerNotification("message");
        } catch {}
      });

      // ── Wallet balance changed ─────────────────────────────────────────────
      es.addEventListener("wallet_update", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      });

      // ── General notification badge ─────────────────────────────────────────
      es.addEventListener("notification_update", () => {
        queryClient.invalidateQueries({ queryKey: ["notif-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!closed) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [user?.id]);
}
