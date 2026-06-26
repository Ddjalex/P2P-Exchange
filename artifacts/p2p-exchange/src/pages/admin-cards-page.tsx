import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { CreditCard, RefreshCw, Search } from "lucide-react";

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
    const matchStatus = statusFilter === "all" || c.card_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(c.user_id).includes(q) ||
      (c.name_on_card ?? "").toLowerCase().includes(q) ||
      (c.card_id ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

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
                        <td className="px-4 py-3 font-mono text-xs">{card.user_id}</td>
                        <td className="px-4 py-3 font-medium">{card.name_on_card ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{card.card_id ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">
                          {card.last4 ? `•••• ${card.last4}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium">${parseFloat(card.balance ?? "0").toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              STATUS_COLORS[card.card_status] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {card.card_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {card.created_at
                            ? new Date(card.created_at).toLocaleDateString()
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
                  <h3 className="font-bold text-foreground">{selected.name_on_card}</h3>
                  <p className="text-xs text-muted-foreground">User #{selected.user_id}</p>
                </div>
                <span
                  className={`ml-auto inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    STATUS_COLORS[selected.card_status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {selected.card_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Card ID", selected.card_id],
                  ["Card User ID", selected.card_user_id],
                  ["Customer ID", selected.customer_id],
                  ["Last 4", selected.last4 ? `•••• ${selected.last4}` : "—"],
                  ["Expiry", selected.expiry ?? "—"],
                  ["Balance", `$${parseFloat(selected.balance ?? "0").toFixed(2)}`],
                  ["Created", selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"],
                  ["Updated", selected.updated_at ? new Date(selected.updated_at).toLocaleString() : "—"],
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
      </AdminLayout>
    </AdminGuard>
  );
}
