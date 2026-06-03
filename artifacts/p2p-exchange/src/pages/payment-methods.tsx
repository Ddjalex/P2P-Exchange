import { AppLayout } from "@/components/layout";
import { ArrowLeft, Trash2, Plus, CreditCard } from "lucide-react";
import { useListPaymentMethods, useAddPaymentMethod, useDeletePaymentMethod, getListPaymentMethodsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PaymentMethodInput } from "@workspace/api-client-react/src/generated/api.schemas";

export default function PaymentMethodsPage() {
  const { data: methods, isLoading } = useListPaymentMethods();
  const [showAdd, setShowAdd] = useState(false);
  const [newMethod, setNewMethod] = useState<Partial<PaymentMethodInput>>({ type: "CBE", accountName: "", accountNumber: "" } as any);
  
  const addMethod = useAddPaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethod.accountName || !newMethod.accountNumber) return;
    addMethod.mutate({ data: newMethod as PaymentMethodInput }, {
      onSuccess: () => {
        toast({ title: "Payment method added" });
        setShowAdd(false);
        setNewMethod({ type: "CBE", accountName: "", accountNumber: "" } as any);
        queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this payment method?")) {
      deleteMethod.mutate({ id, data: undefined as any }, {
        onSuccess: () => {
          toast({ title: "Payment method deleted" });
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
        }
      });
    }
  };

  if (showAdd) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center space-x-3 p-4 border-b border-border">
          <button onClick={() => setShowAdd(false)} className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-bold">Add Payment Method</h1>
        </header>
        <form onSubmit={handleAdd} className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bank / Provider</label>
            <select 
              value={newMethod.type} 
              onChange={e => setNewMethod({ ...newMethod, type: e.target.value as any })}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary"
            >
              {["CBE", "Telebirr", "Awash", "Dashen", "Abyssinia", "HelloCash", "MPesa"].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Name</label>
            <input 
              type="text" 
              placeholder="Exact name on account"
              value={newMethod.accountName}
              onChange={e => setNewMethod({ ...newMethod, accountName: e.target.value })}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Number</label>
            <input 
              type="text" 
              placeholder="Account or phone number"
              value={newMethod.accountNumber}
              onChange={e => setNewMethod({ ...newMethod, accountNumber: e.target.value })}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm focus:border-primary"
            />
          </div>
          <button type="submit" disabled={addMethod.isPending} className="w-full py-3 mt-6 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-50">
            Save Payment Method
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
          methods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between p-4 bg-card border border-card-border rounded-xl">
              <div>
                <div className="font-semibold mb-1 text-sm">{pm.type}</div>
                <div className="text-xs text-muted-foreground mb-1">{pm.accountName}</div>
                <div className="font-mono text-primary font-medium text-sm">{pm.accountNumber}</div>
              </div>
              <button onClick={() => handleDelete(pm.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
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