import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const TOKEN_KEY = "p2p_token";

const KYC_MESSAGES: Record<string, { title: string; description: string; variant?: "default" | "destructive" }> = {
  verified: {
    title: "🎉 KYC Approved!",
    description: "Your identity has been verified. You can now trade on SwapBirr.",
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

      es.addEventListener("kyc_update", async (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { status: string; rejectionReason?: string; adminMessage?: string };
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
