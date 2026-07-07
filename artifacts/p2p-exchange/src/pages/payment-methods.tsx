import { AppLayout } from "@/components/layout";
import {
  ArrowLeft, Trash2, Plus, CreditCard, Smartphone, Building2,
  Wallet, Search,
} from "lucide-react";
import {
  useListPaymentMethods, useAddPaymentMethod, useDeletePaymentMethod,
  getListPaymentMethodsQueryKey, useGetKycStatus, useGetMe,
} from "@workspace/api-client-react";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_COUNTRIES } from "@/constants/payment-countries";

// ── Types ────────────────────────────────────────────────────────────────────

interface PaymentMethodDef {
  id: string;
  name: string;
  fieldType: "bank" | "mobile" | "wallet" | "card";
  accountLabel: string;
  accountPlaceholder: string;
  inputType: "text" | "tel" | "number";
}

interface AvailableMethodsResponse {
  country: string;
  methods: PaymentMethodDef[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAvailableMethods(country: string): Promise<AvailableMethodsResponse> {
  const token = localStorage.getItem("p2p_token");
  const res = await fetch(`/api/profile/payment-methods/available?country=${country}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch available methods");
  return res.json();
}

// ── Icon helper ───────────────────────────────────────────────────────────────

function MethodIcon({ fieldType }: { fieldType: string }) {
  if (fieldType === "mobile") return <Smartphone className="w-4 h-4 text-primary" />;
  if (fieldType === "wallet") return <Wallet className="w-4 h-4 text-primary" />;
  return <Building2 className="w-4 h-4 text-primary" />;
}

// ── Add form ──────────────────────────────────────────────────────────────────

interface AddFormProps {
  userCountry: string;
  kycName: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddPaymentMethodForm({ userCountry, kycName, onClose, onSaved }: AddFormProps) {
  const { toast } = useToast();
  const addMethod = useAddPaymentMethod();

  // Lock country to user's registration country
  const selectedCountry = userCountry || "ET";

  // Method selection within the country
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(kycName || "");
  const [accountNumber, setAccountNumber] = useState("");
  const [methodSearch, setMethodSearch] = useState("");

  const { data: available, isLoading: loadingMethods } = useQuery({
    queryKey: ["available-payment-methods", selectedCountry],
    queryFn: () => fetchAvailableMethods(selectedCountry),
    staleTime: 5 * 60 * 1000,
  });

  const allMethods = available?.methods ?? [];

  // Auto-select first method when list loads
  useEffect(() => {
    if (allMethods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(allMethods[0].id);
    }
  }, [allMethods.length]);

  const filteredMethods = useMemo(() => {
    const q = methodSearch.toLowerCase();
    return q ? allMethods.filter(m => m.name.toLowerCase().includes(q)) : allMethods;
  }, [allMethods, methodSearch]);

  const selectedMethod = allMethods.find(m => m.id === selectedMethodId);

  // Group methods by type
  const grouped = useMemo(() => {
    const banks = filteredMethods.filter(m => m.fieldType === "bank");
    const mobiles = filteredMethods.filter(m => m.fieldType === "mobile");
    const wallets = filteredMethods.filter(m => m.fieldType === "wallet" || m.fieldType === "card");
    return { banks, mobiles, wallets };
  }, [filteredMethods]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }
    const finalName = kycName || accountName.trim();
    if (!finalName) {
      toast({ title: "Please enter your account name", variant: "destructive" });
      return;
    }
    if (!accountNumber.trim()) {
      toast({ title: `Please enter your ${selectedMethod.accountLabel.toLowerCase()}`, variant: "destructive" });
      return;
    }

    addMethod.mutate({
      data: {
        type: selectedMethod.id,
        accountName: finalName,
        accountNumber: accountNumber.trim(),
        country: selectedCountry,
      } as any
    }, {
      onSuccess: () => {
        toast({ title: "Payment method added" });
        onSaved();
      },
      onError: () => {
        toast({ title: "Failed to add payment method", variant: "destructive" });
      },
    });
  };

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={onClose} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">Add Payment Method</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24">
        {/* Method search + selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bank / Provider</label>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search methods..."
              value={methodSearch}
              onChange={e => setMethodSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>

          {loadingMethods ? (
            <div className="space-y-1">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {grouped.mobiles.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-secondary/60 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Mobile Money / Wallets
                  </div>
                  {[...grouped.mobiles, ...grouped.wallets].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethodId(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors border-b border-border/40 last:border-0 ${selectedMethodId === m.id ? "bg-primary/10 text-primary font-semibold" : ""}`}
                    >
                      <MethodIcon fieldType={m.fieldType} />
                      {m.name}
                    </button>
                  ))}
                </>
              )}
              {grouped.banks.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-secondary/60 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Banks
                  </div>
                  {grouped.banks.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethodId(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors border-b border-border/40 last:border-0 ${selectedMethodId === m.id ? "bg-primary/10 text-primary font-semibold" : ""}`}
                    >
                      <MethodIcon fieldType={m.fieldType} />
                      {m.name}
                    </button>
                  ))}
                </>
              )}
              {filteredMethods.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No methods found</div>
              )}
            </div>
          )}

          {selectedMethod && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
              <MethodIcon fieldType={selectedMethod.fieldType} />
              <span className="font-semibold">{selectedMethod.name}</span>
              <span className="text-muted-foreground ml-auto">selected</span>
            </div>
          )}
        </div>

        {/* Account name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Full Name
            {kycName && (
              <span className="ml-2 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                KYC Verified
              </span>
            )}
          </label>
          <input
            type="text"
            readOnly={!!kycName}
            value={kycName || accountName}
            onChange={e => !kycName && setAccountName(e.target.value)}
            placeholder="Exact name on account"
            className={`w-full p-3 rounded-lg outline-none text-sm border ${kycName ? "bg-secondary border-border cursor-not-allowed" : "bg-card border-border focus:border-primary"}`}
          />
          <p className="text-xs text-muted-foreground">
            {kycName
              ? "Locked to your KYC-verified name."
              : `Must match the name registered with ${selectedMethod?.name ?? "the provider"}`}
          </p>
        </div>

        {/* Account number / identifier */}
        {selectedMethod && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{selectedMethod.accountLabel}</label>
            <input
              type={selectedMethod.inputType}
              placeholder={selectedMethod.accountPlaceholder}
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary font-mono"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={addMethod.isPending || !selectedMethod}
          className="w-full py-3 mt-2 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-50"
        >
          {addMethod.isPending ? "Saving..." : "Save Payment Method"}
        </button>
      </form>
    </AppLayout>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage() {
  const { data: methods, isLoading } = useListPaymentMethods();
  const { data: kycData } = useGetKycStatus();
  const { data: me } = useGetMe();
  const [showAdd, setShowAdd] = useState(false);
  const deleteMethod = useDeletePaymentMethod();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const kycName = kycData?.fullName ?? "";
  const registrationCountry = me?.country ?? "ET";

  // Use the fiat currency the user selected on the P2P page (persisted in localStorage).
  // Map fiat code → country code via SUPPORTED_COUNTRIES; fall back to registration country.
  const selectedFiat = localStorage.getItem("p2p_selected_fiat");
  const fiatCountry = selectedFiat
    ? (SUPPORTED_COUNTRIES.find(c => c.currency === selectedFiat)?.code ?? registrationCountry)
    : registrationCountry;
  const userCountry = fiatCountry;

  // Pre-load available methods cache for user's country
  const { data: catalogue } = useQuery({
    queryKey: ["available-payment-methods", userCountry],
    queryFn: () => fetchAvailableMethods(userCountry),
    staleTime: 5 * 60 * 1000,
    enabled: !!userCountry,
  });

  const getMethodDef = (type: string, country: string) => {
    // Try catalogue match for the row's country if different from user country
    return catalogue?.methods.find(m => m.id === type) ?? {
      id: type,
      name: type,
      fieldType: "bank" as const,
      accountLabel: "Account",
      accountPlaceholder: "",
      inputType: "text" as const,
    };
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this payment method?")) {
      deleteMethod.mutate({ id, data: undefined as any }, {
        onSuccess: () => {
          toast({ title: "Payment method removed" });
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
        },
      });
    }
  };

  if (showAdd) {
    return (
      <AddPaymentMethodForm
        userCountry={userCountry}
        kycName={kycName}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          setShowAdd(false);
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
        }}
      />
    );
  }

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border">
        <Link href="/profile" className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="font-bold">Payment Methods</h1>
          <p className="text-xs text-muted-foreground">800+ methods · 119 countries</p>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : methods?.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No payment methods added</p>
            <p className="text-xs mt-1">Add your bank or mobile money account to start trading</p>
          </div>
        ) : (
          methods?.map(pm => {
            const def = getMethodDef((pm as any).type, (pm as any).country ?? "ET");
            const countryInfo = SUPPORTED_COUNTRIES.find(c => c.code === ((pm as any).country ?? "ET"));
            return (
              <div key={pm.id} className="flex items-center justify-between p-4 bg-card border border-card-border rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-md bg-secondary">
                    <MethodIcon fieldType={def.fieldType} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{def.name}</div>
                    {countryInfo && (
                      <div className="text-[10px] text-muted-foreground">{countryInfo.name} · {countryInfo.currency}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">{pm.accountName}</div>
                    <div className="font-mono text-primary font-medium text-sm mt-0.5">
                      {def.fieldType === "mobile" ? "📱 " : ""}{pm.accountNumber}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(pm.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}

        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-4 mt-6 border border-dashed border-primary text-primary rounded-xl font-medium flex items-center justify-center hover:bg-primary/5 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Payment Method
        </button>
      </div>
    </AppLayout>
  );
}
