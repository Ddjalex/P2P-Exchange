import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const NOTIF_ICONS: Record<string, string> = {
  order_created: "🔔",
  payment_sent: "💰",
  order_completed: "✅",
  order_cancelled: "❌",
  appeal_raised: "⚠️",
  appeal_resolved: "⚖️",
  deposit_confirmed: "💚",
  withdrawal_approved: "✅",
  withdrawal_rejected: "❌",
  usdt_frozen: "🔒",
  usdt_unfrozen: "🔓",
  kyc_approved: "✅",
  kyc_rejected: "❌",
  kyc_more_info: "🔄",
  new_message: "💬",
  password_changed: "🔐",
  account_suspended: "🚫",
  account_unsuspended: "✅",
  ad_completed: "🎯",
  ad_suspended: "⚠️",
};

const NOTIF_COLORS: Record<string, string> = {
  order_created: "#00e5ff",
  payment_sent: "#00e5ff",
  order_completed: "#00e676",
  order_cancelled: "#ff4444",
  appeal_raised: "#ff8800",
  deposit_confirmed: "#00e676",
  withdrawal_approved: "#00e676",
  withdrawal_rejected: "#ff4444",
  kyc_approved: "#00e676",
  kyc_rejected: "#ff4444",
  kyc_more_info: "#ff8800",
  new_message: "#00e5ff",
  account_suspended: "#ff4444",
  account_unsuspended: "#00e676",
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("p2p_token");

  const { data: countData } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () =>
      fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    enabled: !!token,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    enabled: isOpen && !!token,
    refetchInterval: isOpen ? 15000 : false,
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOneRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    queryClient.invalidateQueries({ queryKey: ["notif-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const unreadCount: number = countData?.count ?? 0;
  const notifs: any[] = notifData?.notifications ?? [];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "6px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "20px", lineHeight: 1 }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "1px",
              right: "1px",
              background: "#ff4444",
              color: "#fff",
              fontSize: "9px",
              fontWeight: 700,
              borderRadius: "50%",
              minWidth: "15px",
              height: "15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "100%",
              maxWidth: "400px",
              height: "100vh",
              background: "#0f1929",
              borderLeft: "1px solid #334455",
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 16px",
                borderBottom: "1px solid #1e2d3d",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8899aa",
                    fontSize: "20px",
                    cursor: "pointer",
                  }}
                >
                  ←
                </button>
                <h3
                  style={{
                    color: "#fff",
                    fontSize: "18px",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: "#ff4444",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "10px",
                      padding: "2px 7px",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#00e5ff",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {notifs.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "300px",
                    color: "#8899aa",
                  }}
                >
                  <span style={{ fontSize: "48px", marginBottom: "16px" }}>🔔</span>
                  <p style={{ fontSize: "14px", margin: 0 }}>No notifications yet</p>
                </div>
              ) : (
                notifs.map((notif: any) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markOneRead(notif.id);
                      setIsOpen(false);
                      if (notif.relatedOrderId) {
                        if (notif.type === "new_message") {
                          navigate(`/chat/${notif.relatedOrderId}`);
                        } else {
                          navigate(`/trade/${notif.relatedOrderId}`);
                        }
                      }
                    }}
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "14px 16px",
                      borderBottom: "1px solid #1a2535",
                      cursor: notif.relatedOrderId ? "pointer" : "default",
                      background: notif.isRead
                        ? "transparent"
                        : "rgba(0,229,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: `${NOTIF_COLORS[notif.type] || "#00e5ff"}22`,
                        border: `1.5px solid ${NOTIF_COLORS[notif.type] || "#00e5ff"}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        flexShrink: 0,
                      }}
                    >
                      {NOTIF_ICONS[notif.type] || "🔔"}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <p
                          style={{
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: notif.isRead ? 400 : 600,
                            margin: 0,
                            marginBottom: "4px",
                          }}
                        >
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#00e5ff",
                              flexShrink: 0,
                              marginLeft: "8px",
                              marginTop: "4px",
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          color: "#8899aa",
                          fontSize: "12px",
                          margin: 0,
                          marginBottom: "4px",
                          lineHeight: "1.4",
                        }}
                      >
                        {notif.message}
                      </p>
                      <p
                        style={{
                          color: "#556677",
                          fontSize: "11px",
                          margin: 0,
                        }}
                      >
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
