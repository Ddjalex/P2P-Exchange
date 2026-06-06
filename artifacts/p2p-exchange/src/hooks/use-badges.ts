import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { triggerNotification } from "@/helpers/notifications";

const token = () => localStorage.getItem("p2p_token");

export function useBadges() {
  const { data: chatBadge } = useQuery({
    queryKey: ["badge-chat"],
    queryFn: () =>
      fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${token()}` },
      }).then((r) => r.json()),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    enabled: !!token(),
  });

  const { data: orderBadge } = useQuery({
    queryKey: ["badge-orders"],
    queryFn: () =>
      fetch("/api/orders/active-count", {
        headers: { Authorization: `Bearer ${token()}` },
      }).then((r) => r.json()),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    enabled: !!token(),
  });

  const prevChat = useRef(-1);
  const prevOrder = useRef(-1);

  useEffect(() => {
    const chatC = chatBadge?.count ?? 0;
    const orderC = orderBadge?.count ?? 0;

    if (prevChat.current >= 0 && chatC > prevChat.current) {
      triggerNotification("message");
    }
    prevChat.current = chatC;

    if (prevOrder.current >= 0 && orderC > prevOrder.current) {
      triggerNotification("order");
    }
    prevOrder.current = orderC;
  }, [chatBadge?.count, orderBadge?.count]);

  return {
    chatCount: chatBadge?.count ?? 0,
    orderCount: orderBadge?.count ?? 0,
  };
}
