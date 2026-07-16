import { AppLayout } from "@/components/layout";
import {
  ArrowLeft, Trash2, Plus, CreditCard, Smartphone, Building2,
  Wallet, Search,
} from "lucide-react";
import {
  useListPaymentMethods, useAddPaymentMethod, useDeletePaymentMethod,
  getListPaymentMethodsQueryKey, useGetMe,
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

interface CountryGroup {
  country: string;
  countryName: string;
  currency: string;
  methods: PaymentMethodDef[];
}

interface AllMethodsResponse {
  country: "ALL";
  groups: CountryGroup[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAllMethods(): Promise<AllMethodsResponse> {
  const token = localStorage.getItem("p2p_token");
  const res = await fetch(`/api/profile/payment-methods/available?country=ALL`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch available methods");
  return res.json();
}

// ── Icon helper ───────────────────────────────────────────────────────────────

function MethodIcon({ fieldType }: { fieldType: string }) {
  if (fieldType === "mobile")
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">
        <Smartphone className="w-3.5 h-3.5" />
      </span>
    );
  if (fieldType === "wallet")
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex-shrink-0">
        <Wallet className="w-3.5 h-3.5" />
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary flex-shrink-0">
      <Building2 className="w-3.5 h-3.5" />
    </span>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

interface AddFormProps {
  userCountry: string;
  kycName: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddPaymentMethodForm({ userCountry, kycName: kycNameProp, onClose, onSaved }: AddFormProps) {
  const { toast } = useToast();
  const addMethod = useAddPaymentMethod();

  // Fetch me directly inside the form so we never depend on the parent
  // having already resolved its queries when the form opens.
  const { data: formMe } = useGetMe();
  // kycFullName is set by the server when the user has a verified KYC submission or users.name.
  const kycName: string | null = formMe !== undefined ? (formMe.kycFullName ?? null) : null;
  const kycLoaded = formMe !== undefined;
  // Verified = KYC badge is active. Verified users without a stored name get an editable fallback
  // (legacy accounts that predate the KYC submissions table). Unverified users are blocked entirely.
  const isVerified = formMe?.kycStatus === "verified";

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [selectedMethodCountry, setSelectedMethodCountry] = useState(userCountry || "ET");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(""); // editable fallback for verified legacy accounts
  const [methodSearch, setMethodSearch] = useState("");

  // Fetch all 1,760 methods across all countries
  const { data: available, isLoading: loadingMethods } = useQuery({
    queryKey: ["available-payment-methods-all"],
    queryFn: fetchAllMethods,
    staleTime: 10 * 60 * 1000,
  });

  // Build ordered groups: user's country first, then rest alphabetically
  const allGroups: CountryGroup[] = useMemo(() => {
    const groups = available?.groups ?? [];
    const userGroup = groups.find(g => g.country === (userCountry || "ET"));
    const rest = groups.filter(g => g.country !== (userCountry || "ET"));
    return userGroup ? [userGroup, ...rest] : rest;
  }, [available, userCountry]);

  // Auto-select first method of user's country when list loads
  useEffect(() => {
    if (allGroups.length > 0 && !selectedMethodId) {
      const first = allGroups[0]?.methods[0];
      if (first) {
        setSelectedMethodId(first.id);
        setSelectedMethodCountry(allGroups[0].country);
      }
    }
  }, [allGroups.length]);

  // Filter groups by search query (matches method name or country name)
  const filteredGroups: CountryGroup[] = useMemo(() => {
    const q = methodSearch.toLowerCase().trim();
    if (!q) return allGroups;
    return allGroups
      .map(g => ({
        ...g,
        methods: g.methods.filter(m => m.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.methods.length > 0 || g.countryName.toLowerCase().includes(q));
  }, [allGroups, methodSearch]);

  // Find the currently selected method across all groups
  const selectedMethod = useMemo(() => {
    for (const g of allGroups) {
      const m = g.methods.find(m => m.id === selectedMethodId);
      if (m) return m;
    }
    return null;
  }, [allGroups, selectedMethodId]);

  const totalCount = useMemo(() => allGroups.reduce((s, g) => s + g.methods.length, 0), [allGroups]);

  const handleSelect = (method: PaymentMethodDef, countryCode: string) => {
    setSelectedMethodId(method.id);
    setSelectedMethodCountry(countryCode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      toast({ title: "Please complete KYC verification to add a payment method", variant: "destructive" });
      return;
    }
    if (!selectedMethod) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }
    const finalName = kycName || accountName.trim();
    if (!finalName) {
      toast({ title: "Please enter your account holder name", variant: "destructive" });
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
        country: selectedMethodCountry,
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
        <div>
          <h1 className="font-bold">Add Payment Method</h1>
          {totalCount > 0 && (
            <p className="text-[11px] text-muted-foreground">{totalCount.toLocaleString()} methods · {allGroups.length} countries</p>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24">
        {/* Method search + selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bank / Provider</label>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by method or country…"
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
            <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              {filteredGroups.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No methods found</div>
              )}
              {filteredGroups.map(group => (
                <div key={group.country}>
                  {/* Country header */}
                  <div className="px-3 py-1.5 bg-secondary/80 text-xs text-muted-foreground font-semibold uppercase tracking-wide sticky top-0 z-10 border-b border-border/40">
                    {group.countryName}
                    <span className="ml-1.5 font-normal opacity-60">({group.currency})</span>
                  </div>
                  {/* Mobile money + wallets first */}
                  {group.methods.filter(m => m.fieldType === "mobile" || m.fieldType === "wallet" || m.fieldType === "card").map(m => (
                    <button
                      key={`${group.country}-${m.id}`}
                      type="button"
                      onClick={() => handleSelect(m, group.country)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors border-b border-border/40 last:border-0 ${selectedMethodId === m.id && selectedMethodCountry === group.country ? "bg-primary/10 text-primary font-semibold" : ""}`}
                    >
                      <MethodIcon fieldType={m.fieldType} />
                      {m.name}
                    </button>
                  ))}
                  {/* Banks */}
                  {group.methods.filter(m => m.fieldType === "bank").map(m => (
                    <button
                      key={`${group.country}-${m.id}`}
                      type="button"
                      onClick={() => handleSelect(m, group.country)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors border-b border-border/40 last:border-0 ${selectedMethodId === m.id && selectedMethodCountry === group.country ? "bg-primary/10 text-primary font-semibold" : ""}`}
                    >
                      <MethodIcon fieldType={m.fieldType} />
                      {m.name}
                    </button>
                  ))}
                </div>
              ))}
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
            {kycLoaded && kycName && (
              <span className="ml-2 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                KYC Verified
              </span>
            )}
          </label>

          {/* Case 1: not yet loaded — show placeholder */}
          {!kycLoaded && (
            <input type="text" readOnly value="" placeholder="Loading…"
              className="w-full p-3 rounded-lg outline-none text-sm border bg-secondary border-border cursor-not-allowed" />
          )}

          {/* Case 2: loaded, not KYC verified → hard block */}
          {kycLoaded && !isVerified && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
              Please complete KYC verification to add a payment method
            </div>
          )}

          {/* Case 3: verified with a stored name → read-only */}
          {kycLoaded && isVerified && kycName && (
            <>
              <input type="text" readOnly value={kycName}
                className="w-full p-3 rounded-lg outline-none text-sm border bg-secondary border-border cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Locked to your KYC-verified name.</p>
            </>
          )}

          {/* Case 4: verified but no stored name (legacy account) → editable once */}
          {kycLoaded && isVerified && !kycName && (
            <>
              <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                placeholder="Enter your exact legal name"
                className="w-full p-3 rounded-lg outline-none text-sm border bg-card border-border focus:border-primary" />
              <p className="text-xs text-amber-400">
                Enter your exact legal name — this cannot be changed after saving.
              </p>
            </>
          )}
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
          disabled={addMethod.isPending || !selectedMethod || !isVerified}
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
  const { data: me } = useGetMe();
  const [showAdd, setShowAdd] = useState(false);
  const deleteMethod = useDeletePaymentMethod();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // kycFullName is only set by the server when the user has a verified KYC submission
  // (or is a legacy pre-KYC account with ID 3/4/5). Never fall back to unverified sources.
  const kycName = me?.kycFullName ?? "";
  const registrationCountry = me?.country ?? "ET";

  // Use the fiat currency the user selected on the P2P page (persisted in localStorage).
  // Map fiat code → country code via SUPPORTED_COUNTRIES; fall back to registration country.
  const selectedFiat = localStorage.getItem("p2p_selected_fiat");
  const fiatCountry = selectedFiat
    ? (SUPPORTED_COUNTRIES.find(c => c.currency === selectedFiat)?.code ?? registrationCountry)
    : registrationCountry;
  const userCountry = fiatCountry;

  // Re-use the all-methods cache already populated by the add form
  const { data: catalogue } = useQuery({
    queryKey: ["available-payment-methods-all"],
    queryFn: fetchAllMethods,
    staleTime: 10 * 60 * 1000,
  });

  const getMethodDef = (type: string, _country: string) => {
    // Search across all country groups for the matching method definition
    for (const g of catalogue?.groups ?? []) {
      const m = g.methods.find(m => m.id === type);
      if (m) return m;
    }
    return {
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
