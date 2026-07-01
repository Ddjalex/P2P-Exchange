import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost, adminPut } from "@/lib/admin-api";
import { CreditCard, RefreshCw, Search, Link, Settings, AlertTriangle, CheckCircle, DollarSign, ExternalLink, Clock, User, ArrowUpCircle, Plus, Wallet } from "lucide-react";

const QUEUE_STATUS_STYLE: Record<string, string> = {
  pending:    "bg-amber-500/20 text-amber-400",
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
  const [merchantBalanceError, setMerchantBalanceError] = useState<string | null>(null);
  const [merchantBalanceRaw, setMerchantBalanceRaw] = useState<any>(null);
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
    setMerchantBalanceError(null);
    try {
      const data = await adminGet<any>("/cards/merchant-balance");
      setMerchantBalanceRaw(data.debug ?? data.raw ?? null);
      if (data.error) setMerchantBalanceError(data.error);
      setMerchantBalance(data.balance != null ? parseFloat(data.balance) : null);
    } catch {
      setMerchantBalance(null);
      setMerchantBalanceError("API call failed");
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

  const cancelQueueItem = async (id: number) => {
    if (!confirm("Cancel this card request and refund the user?")) return;
    try {
      await adminPut(`/cards/queue/${id}/cancel`);
      setQueueMsg({ ok: true, text: `Queue item #${id} cancelled and user refunded.` });
      loadQueue();
    } catch (e: any) {
      setQueueMsg({ ok: false, text: e?.message ?? "Cancel failed" });
    }
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

          {/* ── Pending Requests Dashboard ── */}
          {(() => {
            const pendingItems = queue.filter(q => q.status === "pending" || q.status === "processing");
            const pendingCount = pendingItems.length;
            const totalPendingAmount = pendingItems.reduce((s, q) => s + parseFloat(q.amount ?? "0"), 0);
            const amountShort = Math.max(0, totalPendingAmount - (merchantBalance ?? 0));
            const balLow = merchantBalance !== null && merchantBalance < 10;
            const hasIssue = balLow && pendingCount > 0;

            return (
              <div className={`bg-card border rounded-xl overflow-hidden ${hasIssue ? "border-amber-500/40" : pendingCount > 0 ? "border-primary/30" : "border-border"}`}>

                {/* Header */}
                <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${hasIssue ? "bg-amber-500/5 border-b border-amber-500/20" : "border-b border-border"}`}>
                  <div className="flex items-center gap-2">
                    {hasIssue
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : pendingCount > 0
                        ? <Clock className="w-4 h-4 text-primary" />
                        : <CheckCircle className="w-4 h-4 text-success" />}
                    <h3 className="font-bold text-sm text-foreground">
                      Card Request Queue
                    </h3>
                    {pendingCount > 0 && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${hasIssue ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}>
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { loadQueue(); loadMerchantBalance(); }}
                      disabled={queueLoading || balanceLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${(queueLoading || balanceLoading) ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    <button
                      onClick={processQueue}
                      disabled={processingQueue}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      <RefreshCw className={`w-3 h-3 ${processingQueue ? "animate-spin" : ""}`} />
                      {processingQueue ? "Processing…" : "Process Queue"}
                    </button>
                  </div>
                </div>

                {/* Summary stat tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-border divide-x divide-border">
                  {/* StroWallet Balance */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">StroWallet Balance</span>
                    </div>
                    {balanceLoading ? (
                      <div className="h-6 w-16 bg-secondary animate-pulse rounded" />
                    ) : merchantBalanceError ? (
                      <span className="text-xs font-semibold text-amber-400">{merchantBalanceError}</span>
                    ) : merchantBalance === null ? (
                      <span className="text-sm font-bold text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-bold ${balLow ? "text-destructive" : "text-success"}`}>${merchantBalance.toFixed(2)}</span>
                        {balLow && <span className="text-xs text-destructive font-medium">⚠ Low</span>}
                      </div>
                    )}
                    <button
                      onClick={loadMerchantBalance}
                      disabled={balanceLoading}
                      className="mt-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> refresh
                    </button>
                    {/* Debug: show probe results whenever balance is 0 or unknown */}
                    {merchantBalanceRaw && (merchantBalance === null || merchantBalance === 0) && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Debug: API probes ▸</summary>
                        <pre className="mt-1 text-xs bg-secondary rounded p-2 overflow-auto max-h-40 text-amber-300 whitespace-pre-wrap break-all">
                          {JSON.stringify(merchantBalanceRaw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  {/* Pending Count */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Pending Requests</span>
                    </div>
                    <span className={`text-lg font-bold ${pendingCount > 0 ? "text-amber-400" : "text-success"}`}>{pendingCount}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{pendingCount === 0 ? "all clear" : `user${pendingCount !== 1 ? "s" : ""} waiting`}</p>
                  </div>

                  {/* Total Amount Needed */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Total Requested</span>
                    </div>
                    <span className={`text-lg font-bold ${pendingCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>${totalPendingAmount.toFixed(2)}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">USDT needed</p>
                  </div>

                  {/* Deposit Needed */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpCircle className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Deposit Needed</span>
                    </div>
                    {amountShort > 0 ? (
                      <>
                        <span className="text-lg font-bold text-destructive">${amountShort.toFixed(2)}</span>
                        <p className="text-xs text-destructive/70 mt-0.5">more to deposit</p>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-success">$0.00</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{pendingCount > 0 ? "ready to process" : "no requests"}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Deposit CTA when balance is insufficient */}
                {hasIssue && amountShort > 0 && (
                  <div className="mx-5 mt-4 mb-1 flex items-center gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl p-4">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-300 mb-0.5">
                        Deposit at least <span className="font-mono">${amountShort.toFixed(2)}</span> to StroWallet to process all {pendingCount} waiting request{pendingCount !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">After depositing, click "Process Queue" — users will get a push notification instantly.</p>
                    </div>
                    <a
                      href="https://strowallet.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Deposit Now
                    </a>
                  </div>
                )}

                {/* Queue feedback message */}
                {queueMsg && (
                  <div className={`mx-5 mt-3 text-xs px-3 py-2 rounded-lg ${queueMsg.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                    {queueMsg.text}
                  </div>
                )}

                {/* Pending items — rich user cards */}
                <div className="p-5 space-y-3">
                  {queueLoading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">Loading requests…</div>
                  ) : queue.length === 0 ? (
                    <div className="py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-success mx-auto mb-2 opacity-60" />
                      <p className="text-sm text-muted-foreground">No card requests in the queue</p>
                    </div>
                  ) : (
                    <>
                      {/* Section labels */}
                      {pendingItems.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">⏳ Pending ({pendingItems.length})</p>
                      )}

                      {/* Pending first */}
                      {queue
                        .slice()
                        .sort((a, b) => {
                          const order: Record<string, number> = { pending: 0, processing: 1, completed: 2, failed: 3 };
                          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                        })
                        .map((item, idx, arr) => {
                          const prevStatus = idx > 0 ? arr[idx - 1].status : item.status;
                          const showCompletedLabel = (item.status === "completed" || item.status === "failed") && prevStatus !== item.status && (idx === 0 || arr[idx - 1].status === "pending" || arr[idx - 1].status === "processing");
                          const displayName = item.userName || `User #${item.userId}`;
                          const initials = displayName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() || "U";
                          const isPending = item.status === "pending" || item.status === "processing";
                          const isFund = item.type === "fund";

                          return (
                            <div key={item.id}>
                              {showCompletedLabel && (
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">✅ Completed / Failed</p>
                              )}
                              <div className={`rounded-xl border p-4 ${isPending ? "bg-amber-500/5 border-amber-500/25" : item.status === "completed" ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                                <div className="flex items-start gap-3">
                                  {/* Avatar */}
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isPending ? "bg-amber-500/20 text-amber-300" : item.status === "completed" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                                    {initials}
                                  </div>

                                  {/* User info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${QUEUE_STATUS_STYLE[item.status] ?? "bg-muted text-muted-foreground"}`}>
                                        {item.status === "pending" && <Clock className="w-2.5 h-2.5" />}
                                        {item.status === "completed" && <CheckCircle className="w-2.5 h-2.5" />}
                                        {item.status}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                                      {item.userEmail && <span className="text-xs text-muted-foreground">{item.userEmail}</span>}
                                      {item.userPhone && <span className="text-xs text-muted-foreground">{item.userPhone}</span>}
                                      <span className="text-xs text-muted-foreground">ID #{item.userId}</span>
                                    </div>

                                    {/* Request details row */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isFund ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"}`}>
                                        {isFund ? <ArrowUpCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                        {isFund ? "Card Top-Up" : "Card Creation"}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="font-mono font-bold text-sm text-foreground">${parseFloat(item.amount ?? "0").toFixed(2)}</span>
                                        <span className="text-xs text-muted-foreground">USDT</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                                      {(item.attempts ?? 0) > 0 && (
                                        <span className="text-xs text-muted-foreground">{item.attempts} attempt{item.attempts !== 1 ? "s" : ""}</span>
                                      )}
                                    </div>

                                    {item.errorMessage && (
                                      <p className="mt-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2.5 py-1.5 border border-border" title={item.errorMessage}>
                                        ⚠ {item.errorMessage.length > 120 ? item.errorMessage.slice(0, 120) + "…" : item.errorMessage}
                                      </p>
                                    )}

                                    {isPending && (
                                      <div className="mt-3">
                                        <button
                                          onClick={() => cancelQueueItem(item.id)}
                                          className="px-3 py-1.5 bg-destructive/10 border border-destructive/25 text-destructive text-xs font-medium rounded-lg hover:bg-destructive/20 transition-colors"
                                        >
                                          Cancel & Refund
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Queue ID */}
                                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">#{item.id}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </>
                  )}
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
