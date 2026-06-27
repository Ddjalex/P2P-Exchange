import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost, adminPut } from "@/lib/admin-api";
import { CreditCard, RefreshCw, Search, Link, Settings, AlertTriangle, CheckCircle, DollarSign, ExternalLink } from "lucide-react";

const QUEUE_STATUS_STYLE: Record<string, string> = {
  pending:    "bg-warning/20 text-warning",
  processing: "bg-blue-500/20 text-blue-400",
  completed:  "bg-success/20 text-success",
  failed:     "bg-destructive/20 text-destructive",
};

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/20 text-success",
  processing: "bg-warning/20 text-warning",
  inactive: "bg-muted text-muted-foreground",
  frozen: "bg-destructive/20 text-destructive",
};

interface CardFees {
  cardCreationFee: string;
  cardInitialLoad: string;
  cardMinFund: string;
}

export default function AdminCardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUserId, setLinkUserId] = useState("");
  const [linkCardId, setLinkCardId] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Settings state
  const [fees, setFees] = useState<CardFees>({ cardCreationFee: "2.00", cardInitialLoad: "3.00", cardMinFund: "2.00" });
  const [feesLoading, setFeesLoading] = useState(true);
  const [feesSaving, setFeesSaving] = useState(false);
  const [feesSaved, setFeesSaved] = useState(false);

  // Queue state
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [merchantBalance, setMerchantBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [queueMsg, setQueueMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminGet<any>("/cards");
      setCards(data.cards ?? []);
    } catch {
      setCards([]);
    }
    setLoading(false);
  };

  const loadFees = async () => {
    setFeesLoading(true);
    try {
      const data = await adminGet<CardFees>("/cards/settings");
      setFees(data);
    } catch {}
    setFeesLoading(false);
  };

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const data = await adminGet<any>("/cards/queue");
      setQueue(data.queue ?? []);
    } catch {
      setQueue([]);
    }
    setQueueLoading(false);
  };

  const loadMerchantBalance = async () => {
    setBalanceLoading(true);
    try {
      const data = await adminGet<any>("/cards/merchant-balance");
      setMerchantBalance(data.balance ?? 0);
    } catch {
      setMerchantBalance(null);
    }
    setBalanceLoading(false);
  };

  const processQueue = async () => {
    setProcessingQueue(true);
    setQueueMsg(null);
    try {
      await adminPost("/cards/process-queue", {});
      setQueueMsg({ ok: true, text: "Queue processing triggered — check back in a moment." });
      setTimeout(() => loadQueue(), 3000);
    } catch (e: any) {
      setQueueMsg({ ok: false, text: e?.message ?? "Failed to trigger queue" });
    }
    setProcessingQueue(false);
  };

  useEffect(() => {
    load();
    loadFees();
    loadQueue();
    loadMerchantBalance();
    const interval = setInterval(() => { loadQueue(); loadMerchantBalance(); }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const saveFees = async () => {
    setFeesSaving(true);
    setFeesSaved(false);
    try {
      const updated = await adminPut<CardFees>("/cards/settings", fees);
      setFees(updated);
      setFeesSaved(true);
      setTimeout(() => setFeesSaved(false), 3000);
    } catch {}
    setFeesSaving(false);
  };

  const filtered = cards.filter((c) => {
    const matchStatus = statusFilter === "all" || c.cardStatus === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(c.userId).includes(q) ||
      (c.nameOnCard ?? "").toLowerCase().includes(q) ||
      (c.cardId ?? "").toLowerCase().includes(q) ||
      (c.userName ?? "").toLowerCase().includes(q) ||
      (c.userEmail ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleLink = async () => {
    if (!linkUserId || !linkCardId) return;
    setLinkLoading(true);
    setLinkResult(null);
    try {
      const data = await adminPost<any>("/cards/link", { userId: parseInt(linkUserId), cardId: linkCardId.trim() });
      setLinkResult({ ok: true, msg: `Linked! Card ID: ${data.card?.cardId ?? linkCardId}` });
      setLinkUserId("");
      setLinkCardId("");
      load();
    } catch (e: any) {
      setLinkResult({ ok: false, msg: e?.message ?? "Link failed" });
    }
    setLinkLoading(false);
  };

  const totalRequired = (parseFloat(fees.cardCreationFee || "0") + parseFloat(fees.cardInitialLoad || "0")).toFixed(2);

  return (
    <AdminGuard>
      <AdminLayout title="Cards Management">
        <div className="space-y-4">

          {/* ── Card Settings Panel ── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Card Settings</h3>
            </div>

            {feesLoading ? (
              <div className="text-xs text-muted-foreground">Loading settings…</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Card Creation Fee ($)", key: "cardCreationFee" as keyof CardFees },
                    { label: "Initial Card Load ($)", key: "cardInitialLoad" as keyof CardFees },
                    { label: "Minimum Top-up ($)", key: "cardMinFund" as keyof CardFees },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fees[key]}
                        onChange={(e) => setFees((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm text-muted-foreground">
                    Total user pays to create:{" "}
                    <span className="font-bold text-foreground">${totalRequired}</span>
                  </div>
                  <button
                    onClick={saveFees}
                    disabled={feesSaving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {feesSaving ? "Saving…" : feesSaved ? "✓ Saved!" : "Save Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── StroWallet Deposit Alert Banner ── */}
          {(() => {
            const pendingCount = queue.filter(q => q.status === "pending" || q.status === "processing").length;
            const balLow = merchantBalance !== null && merchantBalance < 10;
            if (!balLow || pendingCount === 0) return null;
            return (
              <div className="bg-destructive/10 border-2 border-destructive/50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-destructive text-sm">StroWallet Balance Too Low — {pendingCount} Request{pendingCount !== 1 ? "s" : ""} Waiting</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Your StroWallet merchant balance is{" "}
                      <span className="font-bold text-destructive">${merchantBalance?.toFixed(2) ?? "0.00"}</span>,
                      which is too low to process the {pendingCount} pending card request{pendingCount !== 1 ? "s" : ""}.
                      Deposit funds to your StroWallet account, then click <strong>"Process Queue Now"</strong> below to fulfill all pending requests and send push notifications to users.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href="https://strowallet.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-destructive text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Deposit to StroWallet
                      </a>
                      <button
                        onClick={() => { loadMerchantBalance(); loadQueue(); }}
                        disabled={balanceLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
                        Refresh Balance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Pending Queue Panel ── */}
          {(() => {
            const pendingCount = queue.filter(q => q.status === "pending" || q.status === "processing").length;
            const balLow = merchantBalance !== null && merchantBalance < 10;
            return (
              <div className={`bg-card border rounded-xl p-5 ${pendingCount > 0 ? "border-warning/40" : "border-border"}`}>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    {pendingCount > 0
                      ? <AlertTriangle className="w-4 h-4 text-warning" />
                      : <CheckCircle className="w-4 h-4 text-success" />}
                    <h3 className="font-semibold text-sm text-foreground">
                      Pending Card Requests
                      {pendingCount > 0 && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-warning/20 text-warning font-bold">
                          {pendingCount}
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">StroWallet Balance:</span>
                    {balanceLoading ? (
                      <span className="text-muted-foreground animate-pulse">…</span>
                    ) : merchantBalance === null ? (
                      <span className="text-destructive">Error</span>
                    ) : (
                      <span className={`font-bold ${balLow ? "text-destructive" : "text-success"}`}>
                        ${merchantBalance.toFixed(2)}
                        {balLow && <span className="ml-1 px-1.5 py-0.5 bg-destructive/20 text-destructive rounded-full">⚠️ Low</span>}
                      </span>
                    )}
                    <button
                      onClick={loadMerchantBalance}
                      disabled={balanceLoading}
                      className="p-1 bg-secondary rounded border border-border hover:bg-secondary/80 disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {queueLoading ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">Loading queue…</div>
                ) : queue.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">✅ No pending requests</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">ID</th>
                          <th className="text-left px-3 py-2 font-medium">User</th>
                          <th className="text-left px-3 py-2 font-medium">Type</th>
                          <th className="text-left px-3 py-2 font-medium">Amount</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-left px-3 py-2 font-medium">Tries</th>
                          <th className="text-left px-3 py-2 font-medium">Error</th>
                          <th className="text-left px-3 py-2 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((item) => (
                          <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                            <td className="px-3 py-2 font-mono text-muted-foreground">#{item.id}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.userName ?? `User #${item.userId}`}</div>
                              <div className="text-muted-foreground">{item.userEmail ?? ""}</div>
                            </td>
                            <td className="px-3 py-2 capitalize font-medium">{item.type}</td>
                            <td className="px-3 py-2 font-mono font-bold">${parseFloat(item.amount ?? "0").toFixed(2)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${QUEUE_STATUS_STYLE[item.status] ?? "bg-muted text-muted-foreground"}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{item.attempts ?? 0}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={item.errorMessage ?? ""}>{item.errorMessage ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{timeAgo(item.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {queueMsg && (
                  <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${queueMsg.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                    {queueMsg.text}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={processQueue}
                    disabled={processingQueue}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    <RefreshCw className={`w-3 h-3 ${processingQueue ? "animate-spin" : ""}`} />
                    {processingQueue ? "Processing…" : "🔄 Process Queue Now"}
                  </button>
                  <button
                    onClick={() => { loadQueue(); loadMerchantBalance(); }}
                    disabled={queueLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${queueLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Filters & Search ── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {["all", "active", "processing", "inactive", "frozen"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, card ID, user, email…"
                  className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => setShowLink(true)}
                title="Link existing card"
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                <Link className="w-4 h-4" />
                Link Card
              </button>
              <button
                onClick={load}
                className="p-2 bg-secondary rounded-lg border border-border hover:bg-secondary/80"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── Cards Table ── */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Name on Card</th>
                    <th className="text-left px-4 py-3 font-medium">Card ID</th>
                    <th className="text-left px-4 py-3 font-medium">Last 4</th>
                    <th className="text-left px-4 py-3 font-medium">Balance</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">No cards found</td>
                    </tr>
                  ) : (
                    filtered.map((card) => (
                      <tr
                        key={card.id}
                        onClick={() => setSelected(card)}
                        className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs">{card.userName ?? `User #${card.userId}`}</div>
                          <div className="text-muted-foreground text-xs">{card.userEmail ?? `#${card.userId}`}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{card.nameOnCard ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">{card.cardId ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{card.last4 ? `•••• ${card.last4}` : "—"}</td>
                        <td className="px-4 py-3 font-medium">${parseFloat(card.balance ?? "0").toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[card.cardStatus] ?? "bg-muted text-muted-foreground"}`}>
                            {card.cardStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {card.createdAt ? new Date(card.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {filtered.length} card{filtered.length !== 1 ? "s" : ""} shown
          </p>
        </div>

        {/* ── Card detail modal ── */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selected.nameOnCard ?? "—"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selected.userName ?? `User #${selected.userId}`}
                    {selected.userEmail ? ` · ${selected.userEmail}` : ""}
                  </p>
                </div>
                <span className={`ml-auto inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[selected.cardStatus] ?? "bg-muted text-muted-foreground"}`}>
                  {selected.cardStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["User ID", selected.userId],
                  ["Phone", selected.userPhone ?? "—"],
                  ["Card ID", selected.cardId],
                  ["Card User ID", selected.cardUserId],
                  ["Customer ID", selected.customerId],
                  ["Last 4", selected.last4 ? `•••• ${selected.last4}` : "—"],
                  ["Expiry", selected.expiry ?? "—"],
                  ["Balance", `$${parseFloat(selected.balance ?? "0").toFixed(2)}`],
                  ["Created", selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"],
                  ["Updated", selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    <div className="font-medium text-xs font-mono break-all">{value ?? "—"}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setSelected(null)}
                className="w-full py-2.5 bg-secondary rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Link existing card modal ── */}
        {showLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowLink(false); setLinkResult(null); }}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Link className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Link Existing Card</h3>
                  <p className="text-xs text-muted-foreground">Attach a StroWallet card to a user account</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">User ID</label>
                  <input
                    type="number"
                    value={linkUserId}
                    onChange={(e) => setLinkUserId(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">StroWallet Card ID</label>
                  <input
                    type="text"
                    value={linkCardId}
                    onChange={(e) => setLinkCardId(e.target.value)}
                    placeholder="e.g. 019f0416-81ca-7b1f-b9cc-75f0af483861"
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              {linkResult && (
                <div className={`text-sm px-4 py-3 rounded-lg ${linkResult.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                  {linkResult.msg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowLink(false); setLinkResult(null); }}
                  className="flex-1 py-2.5 bg-secondary rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLink}
                  disabled={linkLoading || !linkUserId || !linkCardId}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {linkLoading ? "Linking…" : "Link Card"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
