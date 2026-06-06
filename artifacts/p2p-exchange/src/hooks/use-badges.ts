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

  const { data: notifData } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () =>
      fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token()}` },
      }).then((r) => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    enabled: !!token(),
  });

  const chatCount = chatBadge?.count ?? 0;
  const orderCount = orderBadge?.count ?? 0;
  const notifCount = notifData?.count ?? 0;
  const totalBadge = chatCount + orderCount + notifCount;

  const prevChat = useRef(-1);
  const prevOrder = useRef(-1);

  // ── SET APP ICON BADGE ──
  useEffect(() => {
    if ("setAppBadge" in navigator) {
      if (totalBadge > 0) {
        (navigator as any).setAppBadge(totalBadge);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  }, [totalBadge]);

  // ── DETECT NEW MESSAGES → SOUND + VIBRATE ──
  useEffect(() => {
    if (prevChat.current >= 0 && chatCount > prevChat.current) {
      triggerNotification("message");
    }
    prevChat.current = chatCount;
  }, [chatCount]);

  // ── DETECT NEW ORDERS → SOUND + VIBRATE ──
  useEffect(() => {
    if (prevOrder.current >= 0 && orderCount > prevOrder.current) {
      triggerNotification("order");
    }
    prevOrder.current = orderCount;
  }, [orderCount]);

  return { chatCount, orderCount, notifCount, totalBadge };
}
