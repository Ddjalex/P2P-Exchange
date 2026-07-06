import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost, adminPut, adminDelete } from "@/lib/admin-api";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ShieldCheck, CheckCircle, Trash2, Flag, X, PlusCircle, MinusCircle, Lock } from "lucide-react";

const KYC_COLORS: Record<string, string> = {
  verified: "bg-success/20 text-success", pending: "bg-warning/20 text-warning",
  rejected: "bg-destructive/20 text-destructive", more_info_required: "bg-orange-400/20 text-orange-400",
  none: "bg-muted text-muted-foreground",
};

const SUSPENSION_REASONS = [
  "Fraudulent payment claim",
  "Non-payment after order created",
  "Abusive behaviour in chat",
  "Multiple appeals lost",
  "Fake KYC documents",
  "Other",
];

const SUSPENSION_DURATIONS = [
  { label: "1 Day", value: "1d" },
  { label: "3 Days", value: "3d" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "Permanent", value: "permanent" },
];

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState(SUSPENSION_REASONS[0]);
  const [suspendCustomReason, setSuspendCustomReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState("7d");
  const [suspending, setSuspending] = useState(false);

  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagType, setFlagType] = useState("manual");
  const [flagDesc, setFlagDesc] = useState("");
  const [flagging, setFlagging] = useState(false);

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditType, setCreditType] = useState<"credit" | "debit">("credit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [creditError, setCreditError] = useState("");

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

  const doSuspend = async () => {
    const finalReason = suspendReason === "Other" ? suspendCustomReason : suspendReason;
    if (!finalReason.trim()) return;
    setSuspending(true);
    await adminPut(`/users/${params.id}/suspend`, { reason: finalReason, duration: suspendDuration });
    setShowSuspendModal(false);
    load();
    setSuspending(false);
  };

  const doFlag = async () => {
    if (!flagDesc.trim()) return;
    setFlagging(true);
    await adminPut(`/users/${params.id}/flag`, { flagType, description: flagDesc });
    setShowFlagModal(false);
    load();
    setFlagging(false);
  };

  const doCredit = async () => {
    setCreditError("");
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt <= 0) { setCreditError("Enter a valid amount"); return; }
    setCrediting(true);
    try {
      await adminPost(`/wallets/${params.id}/adjust`, { type: creditType, amount: amt, note: creditNote });
      setShowCreditModal(false);
      setCreditAmount("");
      setCreditNote("");
      load();
    } catch (e: any) {
      setCreditError(e.message);
    } finally {
      setCrediting(false);
    }
  };

  if (loading) return <AdminGuard><AdminLayout title="User Detail"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;
  if (!data) return <AdminGuard><AdminLayout title="User Detail"><div className="text-muted-foreground">User not found</div></AdminLayout></AdminGuard>;

  const { user, wallet, orderCount, kyc, transactions, orders, ads } = data;

  return (
    <AdminGuard>
      <AdminLayout title="User Detail">
        {/* Suspend Modal */}
        {showSuspendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Suspend User</h3>
                <button onClick={() => setShowSuspendModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Reason</label>
                  <select value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                    {SUSPENSION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {suspendReason === "Other" && (
                    <textarea value={suspendCustomReason} onChange={e => setSuspendCustomReason(e.target.value)}
                      placeholder="Describe the reason..."
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-16 outline-none focus:border-primary" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SUSPENSION_DURATIONS.map(d => (
                      <button key={d.value} onClick={() => setSuspendDuration(d.value)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-colors ${suspendDuration === d.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">All active orders will be auto-cancelled and USDT returned.</p>
                <div className="flex space-x-3">
                  <button onClick={() => setShowSuspendModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={doSuspend} disabled={suspending || (suspendReason === "Other" && !suspendCustomReason.trim())}
                    className="flex-1 py-2.5 bg-destructive text-white rounded-lg text-sm font-bold disabled:opacity-40">
                    {suspending ? "Suspending..." : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credit / Debit Modal */}
        {showCreditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Adjust Wallet Balance</h3>
                <button onClick={() => { setShowCreditModal(false); setCreditError(""); }}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["credit", "debit"] as const).map(t => (
                    <button key={t} onClick={() => setCreditType(t)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border capitalize transition-colors ${creditType === t ? (t === "credit" ? "bg-success/10 border-success text-success" : "bg-destructive/10 border-destructive text-destructive") : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"}`}>
                      {t === "credit" ? "➕ Credit" : "➖ Debit"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Amount (USDT)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00"
                    value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Note (optional)</label>
                  <input type="text" placeholder="e.g. Test deposit, deposit fix..."
                    value={creditNote} onChange={e => setCreditNote(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                </div>
                {data?.wallet && (
                  <p className="text-xs text-muted-foreground">
                    Current balance: <span className="font-mono font-semibold text-foreground">{parseFloat(data.wallet.availableBalance).toFixed(2)} USDT</span>
                  </p>
                )}
                {creditError && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2">{creditError}</p>}
                <div className="flex space-x-3">
                  <button onClick={() => { setShowCreditModal(false); setCreditError(""); }} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={doCredit} disabled={crediting || !creditAmount}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 ${creditType === "credit" ? "bg-success text-white" : "bg-destructive text-white"}`}>
                    {crediting ? "Processing..." : creditType === "credit" ? "Credit" : "Debit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flag Modal */}
        {showFlagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Flag User</h3>
                <button onClick={() => setShowFlagModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Flag Type</label>
                  <select value={flagType} onChange={e => setFlagType(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                    <option value="manual">Manual Review</option>
                    <option value="appeal_loss">Appeal Loss</option>
                    <option value="high_cancellation">High Cancellation</option>
                    <option value="negative_feedback">Negative Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Description</label>
                  <textarea value={flagDesc} onChange={e => setFlagDesc(e.target.value)}
                    placeholder="Describe why you're flagging this user..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-20 outline-none focus:border-primary" />
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setShowFlagModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={doFlag} disabled={flagging || !flagDesc.trim()}
                    className="flex-1 py-2.5 bg-warning text-black rounded-lg text-sm font-bold disabled:opacity-40">
                    {flagging ? "Flagging..." : "Flag User"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                {user.flagCount > 0 && (
                  <span className="mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/20 text-warning">
                    ⚑ {user.flagCount} flag{user.flagCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm border-t border-border pt-4">
                {[
                  { label: "Country", value: user.country },
                  { label: "Joined", value: new Date(user.createdAt).toLocaleDateString() },
                  { label: "Total Orders", value: orderCount },
                  { label: "Available USDT", value: wallet ? `${parseFloat(wallet.availableBalance).toFixed(2)}` : "0.00" },
                  { label: "Frozen USDT", value: wallet ? `${parseFloat(wallet.frozenBalance).toFixed(2)}` : "0.00" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant</span>
                  {user.isMerchant ? <CheckCircle className="w-4 h-4 text-success" /> : <span className="text-muted-foreground">No</span>}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={user.isSuspended ? "text-destructive font-semibold" : "text-success"}>
                    {user.isSuspended ? "Suspended" : "Active"}
                  </span>
                </div>
                {user.isSuspended && user.suspensionReason && (
                  <div className="text-xs text-destructive/80 bg-destructive/5 p-2 rounded-lg border border-destructive/20">
                    Reason: {user.suspensionReason}
                    {user.suspendedUntil && <><br />Until: {new Date(user.suspendedUntil).toLocaleDateString()}</>}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Admin Actions</h3>
              <div className="space-y-2">
                <button onClick={() => action("verify")}
                  className="w-full py-2 px-3 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center space-x-2">
                  <ShieldCheck className="w-4 h-4" /><span>Verify KYC Manually</span>
                </button>
                <button onClick={() => action("merchant", { isMerchant: !user.isMerchant })}
                  className="w-full py-2 px-3 bg-warning/10 text-warning border border-warning/20 rounded-lg text-sm font-medium hover:bg-warning/20 transition-colors">
                  {user.isMerchant ? "Revoke Merchant" : "Grant Merchant"}
                </button>
                <button onClick={() => { setCreditType("credit"); setShowCreditModal(true); }}
                  className="w-full py-2 px-3 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center space-x-2">
                  <PlusCircle className="w-4 h-4" /><span>Adjust Balance</span>
                </button>
                <button onClick={() => setShowFlagModal(true)}
                  className="w-full py-2 px-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-medium hover:bg-orange-500/20 transition-colors flex items-center justify-center space-x-2">
                  <Flag className="w-4 h-4" /><span>Flag for Review</span>
                </button>
                {user.isSuspended ? (
                  <button onClick={() => action("unsuspend")}
                    className="w-full py-2 px-3 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-medium hover:bg-success/20 transition-colors">
                    Lift Suspension
                  </button>
                ) : (
                  <button onClick={() => setShowSuspendModal(true)}
                    className="w-full py-2 px-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">
                    Suspend Account
                  </button>
                )}
                <button
                  onClick={() => action("withdrawal-suspend", { suspended: !user.withdrawalSuspended })}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 border ${
                    user.withdrawalSuspended
                      ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{user.withdrawalSuspended ? '✓ Unsuspend Withdrawal' : '🔒 Suspend Withdrawal'}</span>
                </button>
                <button onClick={deleteUser}
                  className="w-full py-2 px-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors flex items-center justify-center space-x-2">
                  <Trash2 className="w-4 h-4" /><span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2">
            <div className="border-b border-border mb-5 flex space-x-1 overflow-x-auto">
              {["overview", "orders", "ads", "kyc", "transactions"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Total Orders", value: orderCount },
                  { label: "Available USDT", value: wallet ? parseFloat(wallet.availableBalance).toFixed(2) : "0.00" },
                  { label: "Frozen USDT", value: wallet ? parseFloat(wallet.frozenBalance).toFixed(2) : "0.00" },
                  { label: "Appeal Losses (30d)", value: user.appealLossCount30d ?? 0 },
                  { label: "Cancellations (7d)", value: user.cancellationCount7d ?? 0 },
                  { label: "Flag Count", value: user.flagCount ?? 0 },
                  { label: "Email Verified", value: user.emailVerified ? "Yes" : "No" },
                  { label: "KYC Status", value: user.kycStatus?.replace('_', ' ') },
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
                {orders?.length === 0
                  ? <div className="text-center text-muted-foreground py-8">No orders</div>
                  : orders?.map((o: any) => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`}
                      className="block p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm">Order #{o.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${o.status === 'completed' ? 'bg-success/20 text-success' : o.status === 'cancelled' ? 'bg-muted text-muted-foreground' : o.status === 'paid' ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'}`}>{o.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{parseFloat(o.amountUsdt).toFixed(4)} USDT · {parseFloat(o.amountEtb).toLocaleString()} ETB</div>
                    </Link>
                  ))}
              </div>
            )}

            {tab === "ads" && (
              <div className="space-y-2">
                {ads?.length === 0
                  ? <div className="text-center text-muted-foreground py-8">No ads</div>
                  : ads?.map((a: any) => (
                    <div key={a.id} className="p-4 bg-card border border-border rounded-xl">
                      <div className="flex justify-between">
                        <span className={`text-sm font-semibold ${a.type === 'buy' ? 'text-success' : 'text-destructive'}`}>{a.type.toUpperCase()} USDT</span>
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
                {transactions?.length === 0
                  ? <div className="text-center text-muted-foreground py-8">No transactions</div>
                  : transactions?.map((t: any) => (
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
