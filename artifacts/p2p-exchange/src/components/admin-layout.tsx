import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  LayoutDashboard, Users, ShieldCheck, Megaphone, ClipboardList,
  Scale, Wallet, MessageSquare, Bell, Settings, DollarSign,
  LogOut, Menu, X, FileText, ChevronRight, ChevronDown,
  AlertTriangle, UserX, Flag, Activity, Layers, PauseCircle, Send, Mail,
} from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  {
    href: "/admin/users", icon: Users, label: "Users",
    children: [
      { href: "/admin/users", label: "All Users" },
      { href: "/admin/users?filter=flagged", label: "Flagged Users" },
      { href: "/admin/users?filter=suspended", label: "Suspended Users" },
    ],
  },
  { href: "/admin/kyc", icon: ShieldCheck, label: "KYC Verification" },
  { href: "/admin/ads", icon: Megaphone, label: "Ads Management" },
  {
    href: "/admin/orders", icon: ClipboardList, label: "Orders & Trades",
    children: [
      { href: "/admin/orders", label: "All Orders" },
      { href: "/admin/orders?filter=active", label: "Active Orders" },
      { href: "/admin/orders?filter=frozen", label: "Frozen USDT" },
    ],
  },
  { href: "/admin/disputes", icon: Scale, label: "Disputes & Appeals" },
  { href: "/admin/fraud", icon: AlertTriangle, label: "Fraud Detection" },
  {
    href: "/admin/wallet", icon: Wallet, label: "Wallet & Transactions",
    children: [
      { href: "/admin/wallet", label: "Platform Wallet" },
      { href: "/admin/wallet?tab=withdrawals", label: "Pending Withdrawals" },
      { href: "/admin/wallet?tab=frozen", label: "Frozen Balances" },
      { href: "/admin/deposits", label: "Deposit Verifications" },
    ],
  },
  { href: "/admin/messages", icon: MessageSquare, label: "Messages Monitor" },
  { href: "/admin/broadcast", icon: Send, label: "Broadcast" },
  { href: "/admin/email", icon: Mail, label: "Email Users" },
  { href: "/admin/notifications", icon: Bell, label: "Notifications" },
  { href: "/admin/settings", icon: Settings, label: "System Settings" },
  { href: "/admin/fees", icon: DollarSign, label: "Fee Management" },
  { href: "/admin/logs", icon: FileText, label: "Audit Logs" },
];

export function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [location] = useLocation();
  const { admin, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const active = navItems.find(n =>
      n.children && (
        location.startsWith(n.href) ||
        n.children.some(c => location === c.href.split("?")[0])
      )
    );
    return active ? [active.href] : [];
  });

  const toggleExpand = (href: string) => {
    setExpanded(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);
  };

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/src/assets/logo-icon.svg" alt="Xendrx" width={36} height={36} />
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '15px', lineHeight: 1.2 }}>xen<span style={{ color: '#00e5ff' }}>drx</span></div>
              <div className="text-xs text-muted-foreground font-medium" style={{ letterSpacing: '1px' }}>ADMIN PANEL</div>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/admin/dashboard" && location.startsWith(item.href) && !location.includes("?"));
            const isExpanded = expanded.includes(item.href);
            const Icon = item.icon;

            if (item.children) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors w-full ${
                      isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="ml-7 mb-1 space-y-0.5">
                      {item.children.map(child => {
                        const childActive = location + (typeof window !== 'undefined' ? window.location.search : '') === child.href || location === child.href.split("?")[0];
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              childActive ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border flex-shrink-0">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">{title}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-muted-foreground hidden sm:block">{admin?.email}</div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {admin?.email?.charAt(0).toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const [, navigate] = useLocation();

  React.useEffect(() => {
    if (!loading && !admin) navigate('/admin/login');
  }, [admin, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!admin) return null;
  return <>{children}</>;
}
