import React from "react";
import { Link, useLocation } from "wouter";
import { Users, Clock, Megaphone, MessageSquare, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function useUnreadNotifCount() {
  const token = localStorage.getItem("p2p_token");
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () =>
      fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    enabled: !!token,
  });
  return (data?.count ?? 0) as number;
}

export function BottomNav() {
  const [location] = useLocation();
  const unreadCount = useUnreadNotifCount();

  const navItems = [
    { href: "/p2p", icon: Users, label: "P2P" },
    { href: "/orders", icon: Clock, label: "Orders" },
    { href: "/ads", icon: Megaphone, label: "Ads" },
    { href: "/chat", icon: MessageSquare, label: "Chat" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          const Icon = item.icon;
          const showBadge =
            item.href === "/orders" && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-destructive rounded-full border border-background flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {item.href === "/chat" && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-warning rounded-full border border-background"></span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout({ children, showNav = true }: { children: React.ReactNode; showNav?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-foreground sm:bg-black/90">
      <div className="min-h-screen bg-background sm:max-w-[480px] sm:mx-auto sm:border-x sm:border-border relative pb-[64px]">
        {children}
        {showNav && <BottomNav />}
      </div>
    </div>
  );
}
