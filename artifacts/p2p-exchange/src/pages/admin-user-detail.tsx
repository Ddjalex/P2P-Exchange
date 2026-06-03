import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminDelete } from "@/lib/admin-api";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ShieldCheck, CheckCircle, Trash2 } from "lucide-react";

const KYC_COLORS: Record<string, string> = {
  verified: "bg-success/20 text-success", pending: "bg-warning/20 text-warning",
  rejected: "bg-destructive/20 text-destructive", more_info_required: "bg-orange/20 text-orange", none: "bg-muted text-muted-foreground",
};

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  const load = () => {
    setLoading(true);
    adminGet<any>(`/users/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [params.id]);

  const action = async (type: string, body?: any) => {
    await adminPut(`/users/${params.id}/${type}`, body);
    load();
  };

  const deleteUser = async () => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    await adminDelete(`/users/${params.id}`);
    navigate("/admin/users");
  };

  if (loading) return <AdminGuard><AdminLayout title="User Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="User Detail"><div className="text-muted-foreground">User not found</div></AdminLayout></AdminGuard>;

  const { user, wallet, orderCount, kyc, transactions, orders, ads } = data;

  return (
    <AdminGuard>
      <AdminLayout title="User Detail">
        <div className="mb-4">
          <Link href="/admin/users" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Users
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left panel */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary mb-3">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <div className="font-bold text-lg">{user.username}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
                {user.phone && <div className="text-xs text-muted-foreground mt-0.5">{user.phone}</div>}
                <span className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${KYC_COLORS[user.kycStatus]}`}>
                  {user.kycStatus?.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-2 text-sm border-t border-border pt-4">
                {[
                  { label: "Country", value: user.country },
                  { label: "Joined", value: new Date(user.createdAt).toLocaleDateString() },
                  { label: "Total Orders", value: orderCount },
                  { label: "Wallet (USDT)", value: wallet ? `${parseFloat(wallet.availableBalance).toFixed(2)} avail / ${parseFloat(wallet.frozenBalance).toFixed(2)} frozen` : "—" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium text-right max-w-[60%]">{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant</span>
                  {user.isMerchant ? <CheckCircle className="w-4 h-4 text-success" /> : <span className="text-muted-foreground">No</span>}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={user.isSuspended ? "text-destructive" : "text-success"}>{user.isSuspended ? "Suspended" : "Active"}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Admin Actions</h3>
              <div className="space-y-2">
                <button onClick={() => action("verify")} className="w-full py-2 px-3 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center space-x-2">
                  <ShieldCheck className="w-4 h-4" /><span>Verify Manually</span>
                </button>
                <button onClick={() => action("merchant", { isMerchant: !user.isMerchant })} className="w-full py-2 px-3 bg-warning/10 text-warning border border-warning/20 rounded-lg text-sm font-medium hover:bg-warning/20 transition-colors">
                  {user.isMerchant ? "Revoke Merchant" : "Grant Merchant"}
                </button>
                {user.isSuspended ? (
                  <button onClick={() => action("unsuspend")} className="w-full py-2 px-3 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-medium hover:bg-success/20 transition-colors">Unsuspend</button>
                ) : (
                  <button onClick={() => { const r = prompt("Reason for suspension:"); if (r !== null) action("suspend", { reason: r }); }} className="w-full py-2 px-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">Suspend Account</button>
                )}
                <button onClick={deleteUser} className="w-full py-2 px-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors flex items-center justify-center space-x-2">
                  <Trash2 className="w-4 h-4" /><span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2">
            <div className="border-b border-border mb-5 flex space-x-1 overflow-x-auto">
              {["overview", "orders", "ads", "kyc", "transactions"].map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Total Orders", value: orderCount },
                  { label: "Available USDT", value: wallet ? parseFloat(wallet.availableBalance).toFixed(2) : "0.00" },
                  { label: "Frozen USDT", value: wallet ? parseFloat(wallet.frozenBalance).toFixed(2) : "0.00" },
                  { label: "Email Verified", value: user.emailVerified ? "Yes" : "No" },
                  { label: "KYC Status", value: user.kycStatus?.replace('_', ' ') },
                  { label: "Country", value: user.country },
                ].map(r => (
                  <div key={r.label} className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">{r.label}</div>
                    <div className="font-semibold font-mono">{r.value}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "orders" && (
              <div className="space-y-2">
                {orders?.length === 0 ? <div className="text-center text-muted-foreground py-8">No orders</div> :
                  orders?.map((o: any) => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`} className="block p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm">Order #{o.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${o.status === 'completed' ? 'bg-success/20 text-success' : o.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-warning/20 text-warning'}`}>{o.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{parseFloat(o.amountUsdt).toFixed(2)} USDT · {parseFloat(o.amountEtb).toLocaleString()} ETB</div>
                    </Link>
                  ))}
              </div>
            )}

            {tab === "ads" && (
              <div className="space-y-2">
                {ads?.length === 0 ? <div className="text-center text-muted-foreground py-8">No ads</div> :
                  ads?.map((a: any) => (
                    <div key={a.id} className="p-4 bg-card border border-border rounded-xl">
                      <div className="flex justify-between">
                        <span className={`text-sm font-semibold ${a.type === 'buy' ? 'text-success' : 'text-destructive'}`}>{a.type.toUpperCase()}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${a.status === 'online' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{a.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{parseFloat(a.price).toLocaleString()} ETB/USDT · Avail: {parseFloat(a.availableAmount).toFixed(2)} USDT</div>
                    </div>
                  ))}
              </div>
            )}

            {tab === "kyc" && (
              <div className="bg-card border border-border rounded-xl p-5">
                {kyc ? (
                  <div className="space-y-3 text-sm">
                    {[["Full Name", kyc.fullName], ["Date of Birth", kyc.dateOfBirth], ["Nationality", kyc.nationality], ["ID Type", kyc.idType], ["Status", kyc.status], ["Submitted", kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleString() : "—"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium capitalize">{v ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center text-muted-foreground py-8">No KYC submission</div>}
              </div>
            )}

            {tab === "transactions" && (
              <div className="space-y-2">
                {transactions?.length === 0 ? <div className="text-center text-muted-foreground py-8">No transactions</div> :
                  transactions?.map((t: any) => (
                    <div key={t.id} className="p-4 bg-card border border-border rounded-xl">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-semibold uppercase ${t.type === 'deposit' ? 'text-success' : 'text-destructive'}`}>{t.type}</span>
                          <span className="font-mono text-sm">{parseFloat(t.amount).toFixed(2)} USDT</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === 'completed' ? 'bg-success/20 text-success' : t.status === 'pending' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>{t.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t.network ?? "—"} · {new Date(t.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
