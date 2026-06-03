import { AppLayout } from "@/components/layout";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateAd, getListAdsQueryKey } from "@workspace/api-client-react";
import type { AdInput } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

export default function PostAdPage() {
  const [step, setStep] = useState(1);
  const [ad, setAd] = useState<Partial<AdInput>>({
    type: "buy",
    priceType: "fixed",
    asset: "USDT",
    fiat: "ETB",
    price: "120.50",
    totalAmount: "",
    minLimit: "",
    maxLimit: "",
    paymentMethods: [],
    paymentTimeLimit: 15,
    autoReply: "",
    region: "ET",
    status: "online"
  } as any);

  const createAd = useCreateAd();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleNext = () => setStep(s => Math.min(3, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const submit = () => {
    createAd.mutate({ data: ad as AdInput }, {
      onSuccess: () => {
        toast({ title: "Ad posted successfully" });
        queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ mine: true }) });
        setLocation("/ads");
      },
      onError: () => {
        toast({ title: "Failed to post ad", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout showNav={false}>
      <header className="p-4 border-b border-border flex items-center">
        <button onClick={() => step > 1 ? handleBack() : setLocation("/ads")} className="text-muted-foreground mr-4">←</button>
        <h1 className="font-bold">Post Ad</h1>
      </header>

      <div className="p-4">
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10"></div>
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? "bg-primary text-background" : "bg-card border border-border text-muted-foreground"}`}>
              {step > s ? <Check className="w-3 h-3" /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex p-1 bg-secondary rounded-lg">
              <button
                className={`flex-1 py-2 text-sm font-semibold rounded-md ${ad.type === "buy" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
                onClick={() => setAd({ ...ad, type: "buy" })}
              >Buy</button>
              <button
                className={`flex-1 py-2 text-sm font-semibold rounded-md ${ad.type === "sell" ? "bg-background shadow text-destructive" : "text-muted-foreground"}`}
                onClick={() => setAd({ ...ad, type: "sell" })}
              >Sell</button>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Asset</label>
                <div className="p-3 bg-secondary rounded border border-border text-sm font-medium">USDT</div>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Fiat</label>
                <div className="p-3 bg-secondary rounded border border-border text-sm font-medium">ETB</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Price</label>
              <div className="flex items-center justify-between border border-border rounded-lg p-2 bg-card">
                <button className="w-10 h-10 bg-secondary rounded flex items-center justify-center font-bold" onClick={() => setAd(a => ({ ...a, price: String(Number(a.price) - 0.1) }))}>-</button>
                <input type="number" value={ad.price} onChange={e => setAd({ ...ad, price: e.target.value })} className="bg-transparent text-center font-mono text-xl font-bold w-full outline-none" />
                <button className="w-10 h-10 bg-secondary rounded flex items-center justify-center font-bold" onClick={() => setAd(a => ({ ...a, price: String(Number(a.price) + 0.1) }))}>+</button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Amount</label>
              <div className="relative">
                <input type="number" placeholder="Enter total amount" value={ad.totalAmount} onChange={e => setAd({ ...ad, totalAmount: e.target.value })} className="w-full p-3 bg-card border border-border rounded outline-none font-mono" />
                <span className="absolute right-3 top-3 text-muted-foreground font-medium text-sm">USDT</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order Limit</label>
              <div className="flex items-center space-x-2">
                <input type="number" placeholder="Min" value={ad.minLimit} onChange={e => setAd({ ...ad, minLimit: e.target.value })} className="w-full p-3 bg-card border border-border rounded outline-none font-mono text-sm" />
                <span className="text-muted-foreground">~</span>
                <input type="number" placeholder="Max" value={ad.maxLimit} onChange={e => setAd({ ...ad, maxLimit: e.target.value })} className="w-full p-3 bg-card border border-border rounded outline-none font-mono text-sm" />
                <span className="text-sm text-muted-foreground font-medium w-10">ETB</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Methods</label>
              <div className="flex flex-wrap gap-2">
                {["CBE", "Telebirr", "Awash", "Dashen"].map(pm => {
                  const isSelected = ad.paymentMethods?.includes(pm);
                  return (
                    <button
                      key={pm}
                      onClick={() => {
                        const m = ad.paymentMethods || [];
                        setAd({ ...ad, paymentMethods: isSelected ? m.filter(x => x !== pm) : [...m, pm] })
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isSelected ? "bg-primary/20 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}
                    >
                      {pm}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Auto-reply (Optional)</label>
              <textarea 
                value={ad.autoReply || ""} 
                onChange={e => setAd({ ...ad, autoReply: e.target.value })}
                className="w-full p-3 bg-card border border-border rounded outline-none text-sm min-h-[100px] resize-none"
                placeholder="Sent to the counterparty automatically after order is created"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex space-x-2">
                {["online", "offline"].map(s => (
                  <button
                    key={s}
                    onClick={() => setAd({ ...ad, status: s as any })}
                    className={`flex-1 py-2 rounded capitalize font-medium text-sm border ${ad.status === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex space-x-3">
          {step > 1 && <button onClick={handleBack} className="flex-1 py-3 bg-secondary rounded font-semibold text-foreground">Previous</button>}
          {step < 3 ? (
            <button onClick={handleNext} className="flex-1 py-3 bg-primary text-background rounded font-semibold">Next</button>
          ) : (
            <button onClick={submit} className="flex-1 py-3 bg-primary text-background rounded font-semibold">Post Ad</button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}