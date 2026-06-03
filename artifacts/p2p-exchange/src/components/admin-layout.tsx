import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  LayoutDashboard, Users, ShieldCheck, Megaphone, ClipboardList,
  Scale, Wallet, MessageSquare, Bell, Settings, DollarSign,
  LogOut, Menu, X, FileText, ChevronRight
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/kyc", icon: ShieldCheck, label: "KYC Verification" },
  { href: "/admin/ads", icon: Megaphone, label: "Ads Management" },
  { href: "/admin/orders", icon: ClipboardList, label: "Orders & Trades" },
  { href: "/admin/disputes", icon: Scale, label: "Disputes & Appeals" },
  { href: "/admin/wallet", icon: Wallet, label: "Wallet & Transactions" },
  { href: "/admin/messages", icon: MessageSquare, label: "Messages" },
  { href: "/admin/notifications", icon: Bell, label: "Notifications" },
  { href: "/admin/settings", icon: Settings, label: "System Settings" },
  { href: "/admin/fees", icon: DollarSign, label: "Fee Management" },
  { href: "/admin/logs", icon: FileText, label: "Audit Logs" },
];

export function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [location] = useLocation();
  const { admin, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        {/* Logo */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-bold text-lg text-primary">EthioP2P</div>
            <div className="text-xs text-muted-foreground">Admin Panel</div>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
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

        {/* Page content */}
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

  useEffect(() => {
    if (!loading && !admin) {
      navigate('/admin/login');
    }
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
