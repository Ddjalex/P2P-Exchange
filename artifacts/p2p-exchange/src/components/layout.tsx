import React from "react";
import { Link, useLocation } from "wouter";
import { Users, Clock, Megaphone, MessageSquare, User } from "lucide-react";
import { useBadges } from "@/hooks/use-badges";
import { Badge } from "@/components/badge";
import { NotificationBlockedBanner } from "@/components/notification-blocked-banner";

export function BottomNav() {
  const [location] = useLocation();
  const { chatCount, orderCount } = useBadges();

  const navItems = [
    { href: "/p2p",     icon: Users,          label: "P2P",    badge: 0 },
    { href: "/orders",  icon: Clock,          label: "Orders", badge: orderCount },
    { href: "/ads",     icon: Megaphone,      label: "Ads",    badge: 0 },
    { href: "/chat",    icon: MessageSquare,  label: "Chat",   badge: chatCount },
    { href: "/profile", icon: User,           label: "Profile",badge: 0 },
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
              <div style={{ position: "relative", display: "inline-flex" }}>
                <Icon className="w-5 h-5" />
                <Badge count={item.badge} />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout({
  children,
  showNav = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground sm:bg-black/90">
      <div className="min-h-screen bg-background sm:max-w-[480px] sm:mx-auto sm:border-x sm:border-border relative pb-[64px]">
        <NotificationBlockedBanner />
        {children}
        {showNav && <BottomNav />}
      </div>
    </div>
  );
}
