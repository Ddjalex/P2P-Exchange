import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut } from "@/lib/admin-api";
import { Pencil, Check, X } from "lucide-react";

const FEE_LABELS: Record<string, string> = {
  makerFee: "Maker Fee (ad poster) %",
  takerFee: "Taker Fee (order placer) %",
  withdrawFeesTRC20: "Withdrawal Fee TRC20 (USDT)",
  withdrawFeesERC20: "Withdrawal Fee ERC20 (USDT)",
  minOrderAmount: "Minimum Order Amount (ETB)",
  maxOrderAmount: "Maximum Order Amount (ETB)",
};

export default function AdminFeesPage() {
  const [fees, setFees] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    adminGet<Record<string, string>>("/fees").then(setFees).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startEdit = (key: string) => { setEditingKey(key); setEditing(e => ({ ...e, [key]: fees[key] })); };
  const cancelEdit = () => setEditingKey(null);
  const saveEdit = async (key: string) => {
    setSaving(true);
    await adminPut("/fees", { [key]: editing[key] });
    setFees(f => ({ ...f, [key]: editing[key] }));
    setEditingKey(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
    setSaving(false);
  };

  if (loading) return <AdminGuard><AdminLayout title="Fee Management"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;

  return (
    <AdminGuard>
      <AdminLayout title="Fee Management">
        <div className="max-w-2xl space-y-5">
          {/* Fee table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Current Fee Structure</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase">
                  <th className="px-5 py-3">Fee Type</th>
                  <th className="px-5 py-3">Current Value</th>
                  <th className="px-5 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(FEE_LABELS).map(([key, label]) => (
                  <tr key={key} className="border-b border-border/50">
                    <td className="px-5 py-3 text-muted-foreground">{label}</td>
                    <td className="px-5 py-3 font-mono font-semibold">
                      {editingKey === key ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editing[key] ?? fees[key]}
                          onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
                          className="w-32 px-2 py-1 bg-background border border-primary rounded text-sm outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className={saved === key ? "text-success" : ""}>{fees[key]}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {editingKey === key ? (
                        <div className="flex space-x-2">
                          <button onClick={() => saveEdit(key)} disabled={saving} className="p-1 rounded bg-success/20 text-success hover:bg-success/30 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(key)} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fee revenue summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Fee Revenue</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Fees This Month", value: "—" },
                { label: "Fees All Time", value: "—" },
                { label: "Maker Fee Rate", value: `${fees.makerFee ?? "0.20"}%` },
                { label: "Taker Fee Rate", value: `${fees.takerFee ?? "0.10"}%` },
              ].map(c => (
                <div key={c.label} className="bg-background rounded-lg border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                  <div className="font-bold font-mono">{c.value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Fee revenue analytics require order completion tracking. Coming soon.</p>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
