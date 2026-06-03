import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { Link } from "wouter";
import { AlertTriangle, TrendingDown, Scale, User } from "lucide-react";

type FraudTab = "flagged" | "cancellations" | "appeal_losses";

export default function AdminFraudPage() {
  const [tab, setTab] = useState<FraudTab>("flagged");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const endpoints: Record<FraudTab, string> = {
      flagged: "/fraud/flagged-users",
      cancellations: "/fraud/high-cancellations",
      appeal_losses: "/fraud/appeal-losses",
    };
    adminGet<any>(endpoints[tab]).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [tab]);

  const tabs: { key: FraudTab; label: string; icon: React.ElementType }[] = [
    { key: "flagged", label: "Flagged Users", icon: AlertTriangle },
    { key: "cancellations", label: "High Cancellations", icon: TrendingDown },
    { key: "appeal_losses", label: "Appeal Losses", icon: Scale },
  ];

  const FLAG_TYPE_COLORS: Record<string, string> = {
    appeal_loss: "bg-destructive/15 text-destructive",
    high_cancellation: "bg-orange-500/15 text-orange-400",
    negative_feedback: "bg-warning/15 text-warning",
    manual: "bg-primary/15 text-primary",
  };

  return (
    <AdminGuard>
      <AdminLayout title="Fraud Detection">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Monitor suspicious activity and flagged users.</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-secondary rounded-xl p-1 mb-6 w-fit">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No records found</p>
          </div>
        ) : (
          <>
            {tab === "flagged" && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">User</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Flag Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Description</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">By</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row: any) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                              {(row.username ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{row.username ?? `User #${row.userId}`}</div>
                              <div className="text-xs text-muted-foreground">{row.email ?? ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FLAG_TYPE_COLORS[row.flagType] ?? "bg-muted text-muted-foreground"}`}>
                            {row.flagType?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{row.description ?? '—'}</td>
                        <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{row.flaggedBy}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${row.userId}`} className="text-xs text-primary hover:underline">View User</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "cancellations" && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">User</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Cancellations (7d)</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Total Orders</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row: any) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.username}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${row.cancellationCount7d >= 5 ? 'text-destructive' : row.cancellationCount7d >= 3 ? 'text-orange-400' : 'text-warning'}`}>
                            {row.cancellationCount7d}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.totalOrders}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${row.isSuspended ? 'bg-destructive/15 text-destructive' : 'bg-success/10 text-success'}`}>
                            {row.isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${row.id}`} className="text-xs text-primary hover:underline">View User</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "appeal_losses" && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">User</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Appeal Losses (30d)</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Flag Count</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row: any) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.username}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${row.appealLossCount30d >= 3 ? 'text-destructive' : 'text-orange-400'}`}>
                            {row.appealLossCount30d}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.flagCount}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${row.isSuspended ? 'bg-destructive/15 text-destructive' : 'bg-success/10 text-success'}`}>
                            {row.isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${row.id}`} className="text-xs text-primary hover:underline">View User</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
