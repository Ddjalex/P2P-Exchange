import { AppLayout } from "@/components/layout";
import { ArrowLeft, Trash2, Plus, CreditCard, Smartphone, Building2, ShieldCheck } from "lucide-react";
import { useListPaymentMethods, useAddPaymentMethod, useDeletePaymentMethod, getListPaymentMethodsQueryKey, useGetKycStatus } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PaymentMethodInput } from "@workspace/api-client-react/src/generated/api.schemas";

type FieldType = "phone" | "account";

interface Provider {
  name: string;
  label: string;
  fieldType: FieldType;
  accountPlaceholder: string;
  accountLabel: string;
  inputType: string;
  namePlaceholder: string;
}

const PROVIDERS: Provider[] = [
  { name: "CBE",       label: "Commercial Bank of Ethiopia (CBE)", fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "13-digit account number",         inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Telebirr",  label: "Telebirr (Ethio Telecom)",          fieldType: "phone",   accountLabel: "Phone Number",   accountPlaceholder: "09XX XXX XXXX",                   inputType: "tel",  namePlaceholder: "Registered full name" },
  { name: "Awash",     label: "Awash Bank",                        fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Dashen",    label: "Dashen Bank",                       fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Abyssinia", label: "Bank of Abyssinia",                 fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "HelloCash", label: "HelloCash",                         fieldType: "phone",   accountLabel: "Phone Number",   accountPlaceholder: "09XX XXX XXXX",                   inputType: "tel",  namePlaceholder: "Registered full name" },
  { name: "MPesa",     label: "M-Pesa (Safaricom)",                fieldType: "phone",   accountLabel: "Phone Number",   accountPlaceholder: "09XX XXX XXXX",                   inputType: "tel",  namePlaceholder: "Registered full name" },
  { name: "CBEBirr",   label: "CBEBirr",                           fieldType: "phone",   accountLabel: "Phone Number",   accountPlaceholder: "09XX XXX XXXX",                   inputType: "tel",  namePlaceholder: "Registered full name" },
  { name: "Amhara",    label: "Amhara Bank",                       fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Wegagen",   label: "Wegagen Bank",                      fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Coopbank",  label: "Cooperative Bank of Oromia",        fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Hibret",    label: "Hibret Bank (United Bank)",         fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Nib",       label: "Nib International Bank",            fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
  { name: "Oromia",    label: "Oromia Bank",                       fieldType: "account", accountLabel: "Account Number", accountPlaceholder: "Account number",                  inputType: "text", namePlaceholder: "Exact name on account" },
];

const getProvider = (name: string) =>
  PROVIDERS.find(p => p.name === name) ?? PROVIDERS[0];

export default function PaymentMethodsPage() {
  const { data: methods, isLoading } = useListPaymentMethods();
  const { data: kycData } = useGetKycStatus();
  const [showAdd, setShowAdd] = useState(false);
  const [newMethod, setNewMethod] = useState<Partial<PaymentMethodInput>>({
    type: "CBE",
    accountName: "",
    accountNumber: "",
  } as any);

  const kycName = kycData?.fullName ?? "";

  useEffect(() => {
    if (kycName) {
      setNewMethod(prev => ({ ...prev, accountName: kycName }));
    }
  }, [kycName]);

  const addMethod = useAddPaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const selectedProvider = getProvider(newMethod.type as string);

  const handleProviderChange = (name: string) => {
    setNewMethod(prev => ({ type: name as any, accountName: prev.accountName, accountNumber: "" } as any));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = kycName || newMethod.accountName?.trim();
    if (!finalName || !newMethod.accountNumber?.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    addMethod.mutate({ data: { ...newMethod, accountName: finalName } as PaymentMethodInput }, {
      onSuccess: () => {
        toast({ title: "Payment method added" });
        setShowAdd(false);
        setNewMethod({ type: "CBE", accountName: "", accountNumber: "" } as any);
        queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to add payment method", variant: "destructive" });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this payment method?")) {
      deleteMethod.mutate({ id, data: undefined as any }, {
        onSuccess: () => {
          toast({ title: "Payment method deleted" });
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
        },
      });
    }
  };

  if (showAdd) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center space-x-3 p-4 border-b border-border">
          <button onClick={() => setShowAdd(false)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">Add Payment Method</h1>
        </header>

        <form onSubmit={handleAdd} className="p-4 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bank / Provider</label>
            <select
              value={newMethod.type as string}
              onChange={e => handleProviderChange(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary"
            >
              <optgroup label="Mobile Money / Wallets">
                {PROVIDERS.filter(p => p.fieldType === "phone").map(p => (
                  <option key={p.name} value={p.name}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Banks">
                {PROVIDERS.filter(p => p.fieldType === "account").map(p => (
                  <option key={p.name} value={p.name}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-xs text-muted-foreground">
            {selectedProvider.fieldType === "phone"
              ? <><Smartphone className="w-4 h-4 shrink-0 text-primary" /> Uses <span className="font-semibold text-foreground mx-1">phone number</span> — no bank account needed</>
              : <><Building2 className="w-4 h-4 shrink-0 text-primary" /> Uses <span className="font-semibold text-foreground mx-1">account number</span> from your bank</>
            }
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              Full Name
              {kycName && (
                <span className="flex items-center gap-1 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> KYC Verified
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly={!!kycName}
                value={kycName || newMethod.accountName || ""}
                onChange={e => !kycName && setNewMethod({ ...newMethod, accountName: e.target.value })}
                placeholder={kycName ? "" : selectedProvider.namePlaceholder}
                className={`w-full p-3 rounded-lg outline-none text-sm border ${kycName ? "bg-secondary border-border text-foreground cursor-not-allowed select-none" : "bg-card border-border focus:border-primary"}`}
              />
              {kycName && (
                <ShieldCheck className="absolute right-3 top-3.5 w-4 h-4 text-primary opacity-60" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {kycName
                ? "Name is locked to your KYC-verified identity and cannot be changed."
                : `Must match the name registered with ${selectedProvider.label}`}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{selectedProvider.accountLabel}</label>
            <input
              type={selectedProvider.inputType}
              placeholder={selectedProvider.accountPlaceholder}
              value={newMethod.accountNumber}
              onChange={e => setNewMethod({ ...newMethod, accountNumber: e.target.value })}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={addMethod.isPending}
            className="w-full py-3 mt-2 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-50"
          >
            {addMethod.isPending ? "Saving..." : "Save Payment Method"}
          </button>
        </form>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border">
        <Link href="/profile" className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-bold">Payment Methods</h1>
      </header>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : methods?.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No payment methods added</p>
          </div>
        ) : (
          methods?.map(pm => {
            const provider = getProvider(pm.type);
            return (
              <div key={pm.id} className="flex items-center justify-between p-4 bg-card border border-card-border rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-md bg-secondary">
                    {provider.fieldType === "phone"
                      ? <Smartphone className="w-4 h-4 text-primary" />
                      : <Building2 className="w-4 h-4 text-primary" />
                    }
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{provider.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pm.accountName}</div>
                    <div className="font-mono text-primary font-medium text-sm mt-0.5">
                      {provider.fieldType === "phone" ? "📱 " : ""}{pm.accountNumber}
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
