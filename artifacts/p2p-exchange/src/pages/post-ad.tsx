import { AppLayout } from "@/components/layout";
import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useCreateAd, useUpdateAd, useGetAd, useListAds, getListAdsQueryKey } from "@workspace/api-client-react";
import type { AdInput } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { FIAT_CURRENCIES, NATIONALITY_TO_CURRENCY } from "@/constants/currencies";

const EMPTY_AD: Partial<AdInput> = {
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
  status: "online",
};

interface UserPaymentMethod {
  id: number;
  type: string;
  accountName: string;
  accountNumber: string;
}

export default function PostAdPage() {
  const params = useParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = !!editId;
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [ad, setAd] = useState<Partial<AdInput>>(EMPTY_AD);
  const [loaded, setLoaded] = useState(!isEdit);
  const [userPaymentMethods, setUserPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [step2Error, setStep2Error] = useState("");
  const [rawWalletAvailable, setRawWalletAvailable] = useState<number | null>(null);

  const [showFiatPicker, setShowFiatPicker] = useState(false);
  const [fiatSearch, setFiatSearch] = useState("");

  const filteredCurrencies = FIAT_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(fiatSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(fiatSearch.toLowerCase())
  );

  const { data: existingAd, isLoading: loadingAd } = useGetAd(editId!, {
    query: { enabled: isEdit },
  });

  const { data: myAdsRaw, isLoading: loadingMyAds } = useListAds(
    { mine: true } as any,
    { query: { enabled: !isEdit } }
  );
  const myAds = Array.isArray(myAdsRaw) ? myAdsRaw : [];
  const hasBuyAd = myAds.some((a: any) => a.type === "buy");
  const hasSellAd = myAds.some((a: any) => a.type === "sell");

  useEffect(() => {
    if (isEdit || loadingMyAds) return;
    if (hasBuyAd && !hasSellAd) setAd(prev => ({ ...prev, type: "sell" }));
    else if (!hasBuyAd) setAd(prev => ({ ...prev, type: "buy" }));
  }, [loadingMyAds]);

  useEffect(() => {
    if (isEdit) return;
    if (user?.country) {
      const defaultFiat = NATIONALITY_TO_CURRENCY[user.country] ?? "ETB";
      setAd(prev => ({ ...prev, fiat: defaultFiat }));
    }
  }, [user?.country, isEdit]);

  useEffect(() => {
    if (existingAd && !loaded) {
      setAd({
        type: existingAd.type as any,
        priceType: (existingAd as any).priceType ?? "fixed",
        asset: existingAd.asset,
        fiat: existingAd.fiat,
        price: String(existingAd.price),
        totalAmount: String(existingAd.totalAmount ?? ""),
        minLimit: String(existingAd.minLimit ?? ""),
        maxLimit: String(existingAd.maxLimit ?? ""),
        paymentMethods: existingAd.paymentMethods ?? [],
        paymentTimeLimit: (existingAd as any).paymentTimeLimit ?? 15,
        autoReply: (existingAd as any).autoReply ?? "",
        region: (existingAd as any).region ?? "ET",
        status: existingAd.status as any,
      });
      setLoaded(true);
    }
  }, [existingAd, loaded]);

  useEffect(() => {
    const token = localStorage.getItem("p2p_token");
    fetch("/api/profile/payment-methods", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => setUserPaymentMethods(Array.isArray(data) ? data : []))
      .catch(() => setUserPaymentMethods([]))
      .finally(() => setLoadingPaymentMethods(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("p2p_token");
    fetch("/api/wallet", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.availableBalance !== undefined) {
          setRawWalletAvailable(parseFloat(data.availableBalance));
        }
      })
      .catch(() => {});
  }, []);

  const adAvailableAmount = isEdit && existingAd?.type === "sell"
    ? parseFloat(String((existingAd as any).availableAmount ?? 0))
    : 0;
  const availableBalance = rawWalletAvailable === null ? null : rawWalletAvailable + adAvailableAmount;

  const adLockedInOrders = isEdit && existingAd
    ? ((existingAd as any).activeOrdersLocked ?? 0)
    : 0;

  const createAd = useCreateAd();
  const updateAd = useUpdateAd();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step1Error, setStep1Error] = useState("");

  const handleNext = () => {
    if (step === 1) {
      setStep1Error("");
      if (!loadingPaymentMethods && ad.type === "sell" && userPaymentMethods.length === 0) {
        setStep1Error("You must add a payment method to your profile before posting a sell ad.");
        return;
      }
    }
    if (step === 2) {
      setStep2Error("");
      if (!ad.totalAmount || Number(ad.totalAmount) <= 0) {
        setStep2Error("Please enter a valid total amount");
        return;
      }
      if (ad.type === "sell") {
        if (isEdit && adLockedInOrders > 0 && Number(ad.totalAmount) < adLockedInOrders) {
          setStep2Error(`Total cannot be less than ${adLockedInOrders.toFixed(4)} USDT (locked in active orders).`);
          return;
        }
        if (availableBalance !== null && Number(ad.totalAmount) > availableBalance) {
          setStep2Error(`Insufficient balance. You only have ${availableBalance.toFixed(4)} USDT available.`);
          return;
        }
      }
      if ((ad.paymentMethods ?? []).length === 0) {
        setStep2Error("Please select at least one payment method");
        return;
      }
      if (ad.minLimit && ad.maxLimit) {
        if (Number(ad.minLimit) >= Number(ad.maxLimit)) {
          setStep2Error("Minimum limit must be less than maximum limit");
          return;
        }
      }
    }
    setStep(s => Math.min(3, s + 1));
  };
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const submit = () => {
    if (isEdit) {
      updateAd.mutate({ id: editId!, data: ad as any }, {
        onSuccess: () => {
          toast({ title: "Ad updated successfully" });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ mine: true }) });
          setLocation("/ads");
        },
        onError: () => {
          toast({ title: "Failed to update ad", variant: "destructive" });
        },
      });
    } else {
      createAd.mutate({ data: ad as AdInput }, {
        onSuccess: () => {
          toast({ title: "Ad posted successfully" });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ mine: "true" } as any) });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ type: "buy" } as any) });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ type: "sell" } as any) });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({} as any) });
          setLocation("/ads");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? err?.message ?? "Failed to post ad";
          toast({ title: msg, variant: "destructive" });
        },
      });
    }
  };

  const isPending = createAd.isPending || updateAd.isPending;

  if (isEdit && loadingAd) {
    return (
      <AppLayout showNav={false}>
        <header className="p-4 border-b border-border flex items-center">
          <button onClick={() => setLocation("/ads")} className="text-muted-foreground mr-4">←</button>
          <h1 className="font-bold">Edit Ad</h1>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!isEdit && !loadingMyAds && hasBuyAd && hasSellAd) {
    return (
      <AppLayout showNav={false}>
        <header className="p-4 border-b border-border flex items-center">
          <button onClick={() => setLocation("/ads")} className="text-muted-foreground mr-4">←</button>
          <h1 className="font-bold">Post Ad</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-10 text-center space-y-4 mt-10">
          <span className="text-5xl">📋</span>
          <h2 className="font-bold text-lg">Ad Limit Reached</h2>
          <p className="text-sm text-muted-foreground">
            You already have 1 buy ad and 1 sell ad. Delete or edit an existing ad before posting a new one.
          </p>
          <button onClick={() => setLocation("/ads")} className="mt-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            View My Ads
          </button>
        </div>
      </AppLayout>
    );
  }

  const selectedFiatInfo = FIAT_CURRENCIES.find(c => c.code === ad.fiat) ?? { code: ad.fiat ?? "ETB", name: "", symbol: "", flag: "🌐" };

  return (
    <AppLayout showNav={false}>
      <header className="p-4 border-b border-border flex items-center">
        <button onClick={() => step > 1 ? handleBack() : setLocation("/ads")} className="text-muted-foreground mr-4">←</button>
        <h1 className="font-bold">{isEdit ? "Edit Ad" : "Post Ad"}</h1>
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
                disabled={!isEdit && hasBuyAd}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${ad.type === "buy" ? "bg-background shadow text-primary" : "text-muted-foreground"} ${!isEdit && hasBuyAd ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => !hasBuyAd && setAd({ ...ad, type: "buy" })}
              >
                Buy{!isEdit && hasBuyAd ? " ✓" : ""}
              </button>
              <button
                disabled={!isEdit && hasSellAd}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${ad.type === "sell" ? "bg-background shadow text-destructive" : "text-muted-foreground"} ${!isEdit && hasSellAd ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => !hasSellAd && setAd({ ...ad, type: "sell" })}
              >
                Sell{!isEdit && hasSellAd ? " ✓" : ""}
              </button>
            </div>
            {!isEdit && (hasBuyAd || hasSellAd) && (
              <p className="text-xs text-muted-foreground -mt-2">
                {hasBuyAd && hasSellAd
                  ? "You already have both ad types."
                  : `You already have a ${hasBuyAd ? "buy" : "sell"} ad — you can only post a ${hasBuyAd ? "sell" : "buy"} ad now.`}
              </p>
            )}

            <div className="flex space-x-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Asset</label>
                <div className="p-3 bg-secondary rounded border border-border text-sm font-medium">USDT</div>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Fiat Currency</label>
                <button
                  type="button"
                  onClick={() => { setShowFiatPicker(true); setFiatSearch(""); }}
                  className="w-full p-3 bg-card border border-border rounded text-sm font-medium text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none">{selectedFiatInfo.flag}</span>
                    <span className="font-bold">{selectedFiatInfo.code}</span>
                    <span className="text-muted-foreground text-xs">{selectedFiatInfo.symbol}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Price <span className="text-xs text-muted-foreground font-normal">({selectedFiatInfo.code}/USDT)</span></label>
              <div className="flex items-center justify-between border border-border rounded-lg p-2 bg-card">
                <button className="w-10 h-10 bg-secondary rounded flex items-center justify-center font-bold" onClick={() => setAd(a => ({ ...a, price: String(Math.max(0, Number(a.price) - 0.1).toFixed(2)) }))}>-</button>
                <input type="number" value={ad.price} onChange={e => setAd({ ...ad, price: e.target.value })} className="bg-transparent text-center font-mono text-xl font-bold w-full outline-none" />
                <button className="w-10 h-10 bg-secondary rounded flex items-center justify-center font-bold" onClick={() => setAd(a => ({ ...a, price: String((Number(a.price) + 0.1).toFixed(2)) }))}>+</button>
              </div>
            </div>

            {step1Error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
                <p className="text-sm text-destructive font-medium">⚠ {step1Error}</p>
                <Link href="/profile/payment-methods" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
                  Add Payment Method →
                </Link>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Total Amount</label>
                {ad.type === "sell" && availableBalance !== null && (
                  <span className="text-xs text-muted-foreground">
                    Available: <span className="text-primary font-mono font-semibold">{availableBalance.toFixed(4)} USDT</span>
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  placeholder="Enter total amount"
                  value={ad.totalAmount}
                  onChange={e => {
                    setStep2Error("");
                    setAd({ ...ad, totalAmount: e.target.value });
                  }}
                  className={`w-full p-3 pr-24 bg-card border rounded outline-none font-mono transition-colors ${
                    ad.type === "sell" && availableBalance !== null && Number(ad.totalAmount) > availableBalance
                      ? "border-destructive"
                      : "border-border"
                  }`}
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  {ad.type === "sell" && availableBalance !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep2Error("");
                        setAd({ ...ad, totalAmount: availableBalance.toFixed(4) });
                      }}
                      className="px-2 py-0.5 bg-primary/15 text-primary text-xs font-bold rounded"
                    >
                      Max
                    </button>
                  )}
                  <span className="text-muted-foreground font-medium text-sm">USDT</span>
                </div>
              </div>
              {ad.type === "sell" && availableBalance !== null && Number(ad.totalAmount) > availableBalance && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  ⚠ Exceeds your available balance of {availableBalance.toFixed(4)} USDT
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order Limit <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <div className="flex items-center space-x-2">
                <input type="number" placeholder="Min" value={ad.minLimit} onChange={e => setAd({ ...ad, minLimit: e.target.value })} className="w-full p-3 bg-card border border-border rounded outline-none font-mono text-sm" />
                <span className="text-muted-foreground">~</span>
                <input type="number" placeholder="Max" value={ad.maxLimit} onChange={e => setAd({ ...ad, maxLimit: e.target.value })} className="w-full p-3 bg-card border border-border rounded outline-none font-mono text-sm" />
                <span className="text-sm text-muted-foreground font-medium w-14">USDT</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Methods</label>
              {loadingPaymentMethods ? (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-8 w-20 rounded-full bg-secondary animate-pulse" />)}
                </div>
              ) : userPaymentMethods.length === 0 ? (
                <div className="bg-secondary/50 border border-border rounded-xl p-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">You have no payment methods saved.</p>
                  <p className="text-xs text-muted-foreground">Add payment methods in Profile → Payment Methods first.</p>
                  <Link href="/profile/payment-methods" className="inline-block mt-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
                    Go to Payment Methods →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userPaymentMethods.map(pm => {
                    const isSelected = (ad.paymentMethods ?? []).includes(pm.type);
                    return (
                      <button
                        key={pm.id}
                        onClick={() => {
                          setStep2Error("");
                          setAd(prev => {
                            const m = prev.paymentMethods ?? [];
                            return { ...prev, paymentMethods: m.includes(pm.type) ? m.filter(x => x !== pm.type) : [...m, pm.type] };
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isSelected ? "bg-primary/20 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}
                      >
                        {pm.type}
                      </button>
                    );
                  })}
                </div>
              )}
              {step2Error && <p className="text-xs text-destructive mt-1">{step2Error}</p>}
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
            <button onClick={submit} disabled={isPending} className="flex-1 py-3 bg-primary text-background rounded font-semibold disabled:opacity-60">
              {isPending ? (isEdit ? "Saving..." : "Posting...") : (isEdit ? "Save Changes" : "Post Ad")}
            </button>
          )}
        </div>
      </div>

      {/* Currency picker bottom sheet */}
      {showFiatPicker && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => { setShowFiatPicker(false); setFiatSearch(""); }}>
          <div className="w-full bg-background rounded-t-2xl sm:max-w-[480px] sm:mx-auto max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-lg">Select Currency</h3>
              <button onClick={() => { setShowFiatPicker(false); setFiatSearch(""); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="flex items-center bg-secondary rounded-xl px-4 py-2.5 gap-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  autoFocus
                  value={fiatSearch}
                  onChange={e => setFiatSearch(e.target.value)}
                  placeholder="Search currency..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                {fiatSearch && (
                  <button onClick={() => setFiatSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-3 pb-6 space-y-0.5">
              {filteredCurrencies.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setAd(a => ({ ...a, fiat: c.code }));
                    setShowFiatPicker(false);
                    setFiatSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${ad.fiat === c.code ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary"}`}
                >
                  <span className="text-2xl leading-none w-8 text-center">{c.flag}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{c.code}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono">{c.symbol}</span>
                  {ad.fiat === c.code && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
              {filteredCurrencies.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No currencies found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
