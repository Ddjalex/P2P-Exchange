import { useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { Pencil, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const FEE_CONFIG = [
  { key: "maker_fee_percent", label: "Maker Fee (ad poster)", unit: "%", description: "Charged to the user who posted the ad" },
  { key: "taker_fee_percent", label: "Taker Fee (order placer)", unit: "%", description: "Charged to the user who placed the order" },
  { key: "withdrawal_fee_trc20", label: "Withdrawal Fee TRC20", unit: "USDT", description: "Fixed fee for TRC20 withdrawals" },
  { key: "withdrawal_fee_erc20", label: "Withdrawal Fee ERC20", unit: "USDT", description: "Fixed fee for ERC20 withdrawals" },
];

function getAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

function FeeRow({
  feeKey, label, unit, description, currentValue, onSave,
}: {
  feeKey: string;
  label: string;
  unit: string;
  description: string;
  currentValue: number | undefined;
  onSave: (feeType: string, value: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setValue(String(currentValue ?? "")); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    await onSave(feeKey, parsed);
    setEditing(false);
    setSaving(false);
  };

  return (
    <tr className="border-b border-border/50">
      <td className="px-5 py-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </td>
      <td className="px-5 py-4">
        {editing ? (
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            step="0.01"
            min="0"
            max="10"
            autoFocus
            className="w-28 px-2 py-1 bg-background border border-primary rounded text-sm outline-none font-mono"
          />
        ) : (
          <span className="font-mono font-semibold text-primary">
            {currentValue !== undefined ? currentValue : "—"}{unit}
          </span>
        )}
      </td>
      <td className="px-5 py-4">
        {editing ? (
          <div className="flex space-x-2">
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded bg-success/20 text-success hover:bg-success/30 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={cancel}
              className="p-1.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AdminFeesPage() {
  const qc = useQueryClient();
  const token = getAdminToken();

  const { data: fees, isLoading } = useQuery({
    queryKey: ["admin-fees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/fees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json() as Promise<Record<string, number>>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ feeType, value }: { feeType: string; value: number }) => {
      const res = await fetch("/api/admin/fees", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ feeType, value }),
      });
      if (!res.ok) throw new Error("Failed to update fee");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-fees"] }),
  });

  const handleSave = async (feeType: string, value: number) => {
    await updateMutation.mutateAsync({ feeType, value });
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminLayout title="Fee Management">
          <div className="text-muted-foreground">Loading...</div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  const makerFee = fees?.maker_fee_percent ?? 0.20;
  const takerFee = fees?.taker_fee_percent ?? 0.10;
  const totalCollected = fees?.totalCollected ?? 0;

  return (
    <AdminGuard>
      <AdminLayout title="Fee Management">
        <div className="max-w-2xl space-y-5">
          {/* Fee table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Current Fee Structure</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Fees are applied when an order is completed. Changes take effect on the next order.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left text-muted-foreground text-xs uppercase">
                  <th className="px-5 py-3">Fee Type</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {FEE_CONFIG.map(fee => (
                  <FeeRow
                    key={fee.key}
                    feeKey={fee.key}
                    label={fee.label}
                    unit={fee.unit}
                    description={fee.description}
                    currentValue={fees?.[fee.key]}
                    onSave={handleSave}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Fee revenue summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Fee Revenue</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-lg border border-border p-4 col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Total Platform Fees Collected</div>
                <div className="text-2xl font-bold font-mono text-primary">{Number(totalCollected).toFixed(4)} USDT</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ≈ {(Number(totalCollected) * 178).toLocaleString()} ETB
                </div>
              </div>
              <div className="bg-background rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Maker Fee Rate</div>
                <div className="font-bold font-mono">{makerFee}%</div>
              </div>
              <div className="bg-background rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Taker Fee Rate</div>
                <div className="font-bold font-mono">{takerFee}%</div>
              </div>
              <div className="bg-background rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Trading Fee</div>
                <div className="font-bold font-mono">{(makerFee + takerFee).toFixed(2)}%</div>
              </div>
              <div className="bg-background rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">Fee Model</div>
                <div className="font-bold text-xs">Maker + Taker</div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
