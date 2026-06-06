import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { Link } from "wouter";
import { Users, ShieldCheck, ClipboardList, Scale, Wallet, ArrowRight, TrendingUp } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#00e5ff", "#f39c12", "#e74c3c", "#00b894"];

interface Stats {
  totalUsers: number; pendingKyc: number; openOrders: number;
  openDisputes: number; pendingWithdrawals: number; completedOrders: number;
  totalVolume: string; kycStats: Record<string, number>;
}

function StatCard({ label, value, icon: Icon, color = "primary", href }: { label: string; value: number | string; icon: any; color?: string; href?: string }) {
  const content = (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {href && <div className="flex items-center mt-2 text-xs text-primary"><span>View all</span><ArrowRight className="w-3 h-3 ml-1" /></div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<any>(null);
  const [waitlist, setWaitlist] = useState<{ total: number; users: any[] } | null>(null);

  useEffect(() => {
    adminGet<Stats>("/stats/overview").then(setStats).catch(() => {});
    adminGet<any>("/stats/activity").then(setActivity).catch(() => {});
    adminGet<any>("/card/waitlist").then(setWaitlist).catch(() => {});
  }, []);

  const kycPieData = stats ? [
    { name: "Verified", value: stats.kycStats?.verified ?? 0 },
    { name: "Pending", value: stats.kycStats?.pending ?? 0 },
    { name: "Rejected", value: stats.kycStats?.rejected ?? 0 },
    { name: "None", value: stats.kycStats?.none ?? 0 },
  ] : [];

  const volumeData = activity?.recentOrders?.slice(0, 7).map((o: any, i: number) => ({
    name: `Order ${o.id}`,
    usdt: parseFloat(o.amountUsdt || "0"),
  })) ?? [];

  const userBarData = activity?.recentUsers?.map((u: any) => ({
    name: u.username?.slice(0, 8),
    count: 1,
  })) ?? [];

  return (
    <AdminGuard>
      <AdminLayout title="Dashboard">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Users" value={stats?.totalUsers ?? "—"} icon={Users} href="/admin/users" />
          <StatCard label="Pending KYC" value={stats?.pendingKyc ?? "—"} icon={ShieldCheck} href="/admin/kyc" />
          <StatCard label="Open Orders" value={stats?.openOrders ?? "—"} icon={ClipboardList} href="/admin/orders" />
          <StatCard label="Open Disputes" value={stats?.openDisputes ?? "—"} icon={Scale} href="/admin/disputes" />
          <StatCard label="Completed Orders" value={stats?.completedOrders ?? "—"} icon={TrendingUp} />
          <StatCard label="Pending Withdrawals" value={stats?.pendingWithdrawals ?? "—"} icon={Wallet} href="/admin/wallet" />
          <StatCard label="Total Volume (USDT)" value={parseFloat(stats?.totalVolume ?? "0").toLocaleString()} icon={Wallet} />
          <StatCard label="Platform Fees" value="—" icon={Wallet} href="/admin/fees" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 text-sm">Recent Order Volume (USDT)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={volumeData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#8899aa" />
                <YAxis tick={{ fontSize: 10 }} stroke="#8899aa" />
                <Tooltip contentStyle={{ background: '#16213e', border: '1px solid #2a2a4a', fontSize: 12 }} />
                <Line type="monotone" dataKey="usdt" stroke="#00e5ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 text-sm">KYC Status</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={kycPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                  {kycPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#16213e', border: '1px solid #2a2a4a', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {kycPieData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-mono">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card Waitlist */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">💳 Card Waitlist</h3>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-primary">{waitlist?.total ?? 0}</span>
              <span className="text-xs text-muted-foreground">users waiting</span>
              <button
                onClick={() => {
                  if (!waitlist?.users?.length) return;
                  const csv = "Username,KYC Name,Email,Joined\n" +
                    waitlist.users.map((u: any) =>
                      `${u.username ?? ""},${u.kycName ?? ""},${u.email ?? ""},${u.joinedAt}`
                    ).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "card-waitlist.csv"; a.click();
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-primary hover:bg-primary/10 transition-colors"
              >
                📥 Export CSV
              </button>
            </div>
          </div>
          {waitlist?.users?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Username</th>
                    <th className="text-left text-xs text-muted-foreground pb-2 font-medium">KYC Name</th>
                    <th className="text-left text-xs text-muted-foreground pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.users.map((u: any) => (
                    <tr key={u.id} className="border-b border-border/40">
                      <td className="py-2 text-sm">{u.username}</td>
                      <td className="py-2 text-sm text-muted-foreground">{u.kycName ?? "—"}</td>
                      <td className="py-2 text-xs text-muted-foreground">{new Date(u.joinedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users on waitlist yet.</p>
          )}
        </div>

        {/* Quick actions + Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Review Pending KYC", href: "/admin/kyc", count: stats?.pendingKyc },
                { label: "Review Open Disputes", href: "/admin/disputes", count: stats?.openDisputes },
                { label: "Pending Withdrawals", href: "/admin/wallet", count: stats?.pendingWithdrawals },
              ].map(a => (
                <Link key={a.href} href={a.href} className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-secondary transition-colors">
                  <span className="text-sm">{a.label}</span>
                  {a.count !== undefined && a.count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">{a.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 text-sm">Recent Activity</h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {activity?.recentUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">
                      {u.username?.charAt(0).toUpperCase()}
                    </div>
                    <span>New user: <span className="text-primary">{u.username}</span></span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {activity?.recentOrders?.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center text-xs text-warning font-bold">O</div>
                    <span>Order #{o.id} — <span className="font-mono text-xs">{parseFloat(o.amountUsdt || 0).toFixed(2)} USDT</span></span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'completed' ? 'bg-success/20 text-success' : o.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-warning/20 text-warning'}`}>{o.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
