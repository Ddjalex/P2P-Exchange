import React from "react";
import { Link, useLocation } from "wouter";
import { Users, Clock, Megaphone, MessageSquare, User } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const [location] = useLocation();

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
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopBar() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "480px",
        zIndex: 40,
        display: "flex",
        justifyContent: "flex-end",
        padding: "8px 12px",
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <NotificationBell />
      </div>
    </div>
  );
}

export function AppLayout({
  children,
  showNav = true,
  showBell = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
  showBell?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground sm:bg-black/90">
      <div className="min-h-screen bg-background sm:max-w-[480px] sm:mx-auto sm:border-x sm:border-border relative pb-[64px]">
        {children}
        {showNav && <BottomNav />}
        {showBell && showNav && <TopBar />}
      </div>
    </div>
  );
}
