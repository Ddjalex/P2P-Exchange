import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { CreditCard, RefreshCw, Search, Link } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/20 text-success",
  processing: "bg-warning/20 text-warning",
  inactive: "bg-destructive/20 text-destructive",
  frozen: "bg-destructive/20 text-destructive",
};

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

  useEffect(() => { load(); }, []);

  const filtered = cards.filter((c) => {
    const matchStatus = statusFilter === "all" || c.cardStatus === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(c.userId).includes(q) ||
      (c.nameOnCard ?? "").toLowerCase().includes(q) ||
      (c.cardId ?? "").toLowerCase().includes(q);
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

  return (
    <AdminGuard>
      <AdminLayout title="Cards Management">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {["all", "active", "processing", "inactive"].map((s) => (
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
                  placeholder="Search by name, card ID, user ID…"
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

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left px-4 py-3 font-medium">User ID</th>
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
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        No cards found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((card) => (
                      <tr
                        key={card.id}
                        onClick={() => setSelected(card)}
                        className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">{card.userId}</td>
                        <td className="px-4 py-3 font-medium">{card.nameOnCard ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{card.cardId ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">
                          {card.last4 ? `•••• ${card.last4}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium">${parseFloat(card.balance ?? "0").toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              STATUS_COLORS[card.cardStatus] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {card.cardStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {card.createdAt
                            ? new Date(card.createdAt).toLocaleDateString()
                            : "—"}
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

        {/* Card detail modal */}
        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selected.nameOnCard}</h3>
                  <p className="text-xs text-muted-foreground">User #{selected.userId}</p>
                </div>
                <span
                  className={`ml-auto inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    STATUS_COLORS[selected.cardStatus] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {selected.cardStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
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

        {/* Link existing card modal */}
        {showLink && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { setShowLink(false); setLinkResult(null); }}
          >
            <div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
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
