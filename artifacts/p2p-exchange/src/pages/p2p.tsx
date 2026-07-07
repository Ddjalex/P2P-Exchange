import { AppLayout } from "@/components/layout";
import { Bell, Filter, ShieldCheck, X, ChevronDown, RefreshCw, Check, Search } from "lucide-react";
import { useListAds } from "@workspace/api-client-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { FIAT_CURRENCIES, NATIONALITY_TO_CURRENCY, getFiatCurrency, getFlagUrl } from "@/constants/currencies";

const PAYMENT_OPTIONS = [
  "All",
  "CBE",
  "Telebirr",
  "Awash Bank",
  "Dashen Bank",
  "Abyssinia Bank",
  "HelloCash",
  "M-Pesa",
];

export default function P2PPage() {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [amountInput, setAmountInput] = useState("");
  const [appliedAmount, setAppliedAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("All");

  const defaultFiat = user?.country ? (NATIONALITY_TO_CURRENCY[user.country] ?? "ETB") : "ETB";
  const [selectedFiat, setSelectedFiat] = useState<string>(() => {
    return localStorage.getItem("p2p_selected_fiat") || defaultFiat;
  });
  const [showFiatPicker, setShowFiatPicker] = useState(false);
  const [fiatSearch, setFiatSearch] = useState("");

  // Seed localStorage with country default only on first-ever visit (no saved preference)
  useEffect(() => {
    if (user?.country && !localStorage.getItem("p2p_selected_fiat")) {
      setSelectedFiat(NATIONALITY_TO_CURRENCY[user.country] ?? "ETB");
    }
  }, [user?.country]);

  const filteredFiatCurrencies = FIAT_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(fiatSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(fiatSearch.toLowerCase())
  );

  const fiatInfo = getFiatCurrency(selectedFiat);

  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const paymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paymentRef.current && !paymentRef.current.contains(e.target as Node)) {
        setShowPaymentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const apiType = type === "buy" ? "sell" : "buy";
  const filterParams: Record<string, string> = { type: apiType, fiat: selectedFiat };
  if (appliedAmount) filterParams.min_amount = appliedAmount;
  if (selectedPayment !== "All") filterParams.payment_method = selectedPayment;

  const { data: adsRaw, isLoading, isFetching, dataUpdatedAt } = useListAds(filterParams as any, {
    query: { refetchInterval: 30_000 },
  });
  const ads = Array.isArray(adsRaw) ? adsRaw : [];

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const updatedLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const secs = Math.floor((Date.now() - dataUpdatedAt) / 1000);
    if (secs < 10) return "just now";
    if (secs < 60) return `${Math.floor(secs / 5) * 5}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, Math.floor(Date.now() / 5000)]);

  const hasFilters = appliedAmount || selectedPayment !== "All";

  const clearFilters = () => {
    setAmountInput("");
    setAppliedAmount("");
    setSelectedPayment("All");
  };

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4">
        <div className="flex space-x-4 text-lg">
          <button onClick={() => setLocation("/wallet")} className="text-muted-foreground font-medium">Wallet</button>
          <button className="text-white font-bold">P2P</button>
          <button onClick={() => setLocation("/card")} className="text-muted-foreground font-medium">Card</button>
        </div>
        <div className="flex items-center space-x-3">
          {/* Currency selector */}
          <button
            onClick={() => { setShowFiatPicker(true); setFiatSearch(""); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-colors"
          >
            {getFlagUrl(fiatInfo.flag, "sm") && (
              <img src={getFlagUrl(fiatInfo.flag, "sm")} alt={selectedFiat} className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" />
            )}
            <span className="font-bold text-sm">{selectedFiat}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <Bell className="w-5 h-5 text-muted-foreground" />
        </div>
      </header>

      {/* Buy / Sell tabs */}
      <div className="px-4 mb-4">
        <div className="flex p-1 bg-secondary rounded-lg">
          <button
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "buy" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            onClick={() => setType("buy")}
          >
            Buy
          </button>
          <button
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "sell" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            onClick={() => setType("sell")}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="px-4 mb-4 flex space-x-2 relative">
        <button
          onClick={() => setShowAmountModal(true)}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded border text-left flex items-center justify-between transition-colors ${appliedAmount ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}
        >
          <span>{appliedAmount ? `${fiatInfo.symbol} ${Number(appliedAmount).toLocaleString()}` : "Amount"}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        <div ref={paymentRef} className="flex-1 relative">
          <button
            onClick={() => setShowPaymentDropdown(v => !v)}
            className={`w-full py-2 px-3 text-xs font-medium rounded border text-left flex items-center justify-between transition-colors ${selectedPayment !== "All" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}
          >
            <span className="truncate">{selectedPayment === "All" ? "Payment" : selectedPayment}</span>
            <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
          </button>
          {showPaymentDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
              {PAYMENT_OPTIONS.map(pm => (
                <button
                  key={pm}
                  onClick={() => { setSelectedPayment(pm); setShowPaymentDropdown(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${selectedPayment === pm ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"}`}
                >
                  {pm}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="p-2 rounded border border-primary/40 bg-primary/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-primary" />
          </button>
        )}
        {!hasFilters && (
          <button className="p-2 rounded border border-border bg-card flex items-center justify-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Amount filter modal */}
      {showAmountModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="bg-card border border-border rounded-t-2xl p-6 w-full sm:max-w-[480px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Filter by Amount</h3>
              <button onClick={() => setShowAmountModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Enter {selectedFiat} amount — shows ads whose limits cover this amount</p>
            <div className="flex items-center bg-secondary rounded-xl px-4 py-3 mb-4">
              <span className="text-sm text-muted-foreground mr-2">{fiatInfo.symbol}</span>
              <input
                type="number"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="e.g. 5000"
                className="flex-1 bg-transparent text-base font-bold outline-none"
                autoFocus
              />
              {amountInput && (
                <button onClick={() => setAmountInput("")}><X className="w-4 h-4 text-muted-foreground" /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setAmountInput(""); setAppliedAmount(""); setShowAmountModal(false); }}
                className="py-3 rounded-xl border border-border text-sm font-semibold"
              >
                Reset
              </button>
              <button
                onClick={() => { setAppliedAmount(amountInput); setShowAmountModal(false); }}
                className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency picker bottom sheet */}
      {showFiatPicker && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => { setShowFiatPicker(false); setFiatSearch(""); }}>
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
              {filteredFiatCurrencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => {
                    setSelectedFiat(c.code);
                    localStorage.setItem("p2p_selected_fiat", c.code);
                    setShowFiatPicker(false);
                    setFiatSearch("");
                    setAppliedAmount("");
                    setAmountInput("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${selectedFiat === c.code ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary"}`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-secondary flex items-center justify-center">
                    {getFlagUrl(c.flag) ? (
                      <img src={getFlagUrl(c.flag)} alt={c.code} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{c.code.slice(0,2)}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{c.code}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono">{c.symbol}</span>
                  {selectedFiat === c.code && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
              {filteredFiatCurrencies.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No currencies found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refresh indicator */}
      {updatedLabel && (
        <div className="px-4 mb-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {ads.length} {ads.length === 1 ? "ad" : "ads"} · refreshes every 30s
          </span>
          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin text-primary" : ""}`} />
            <span>{updatedLabel}</span>
          </div>
        </div>
      )}

      {/* Ad list */}
      <div className="px-4 space-y-3 pb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-card-border space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        ) : ads?.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">No Ads Found</p>
            <p className="text-xs mt-1">No {selectedFiat} ads available right now</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-primary underline">Clear filters</button>
            )}
          </div>
        ) : (
          ads?.map((ad) => {
            const adFiatInfo = getFiatCurrency(ad.fiat ?? selectedFiat);
            return (
              <div key={ad.id} className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <button className="flex items-center space-x-2 text-left" onClick={(e) => { e.stopPropagation(); setLocation(`/trader/${ad.userId}`); }}>
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                      {ad.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="font-medium text-sm">{ad.username}</span>
                        {ad.isMerchant && <div className="w-3 h-3 rounded-full bg-warning flex items-center justify-center text-[8px] text-background">✓</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ad.orderCount} orders · {ad.completionRate}
                      </div>
                    </div>
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Price</div>
                    <div className="text-lg font-bold font-mono text-primary">{Number(ad.price).toLocaleString()} <span className="text-xs">{adFiatInfo.symbol || adFiatInfo.code}</span></div>
                  </div>
                </div>

                <div className="space-y-1 mb-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-mono">{Number(ad.availableAmount).toLocaleString()} USDT</span>
                  </div>
                  {(Number(ad.minLimit) !== 0 || Number(ad.maxLimit) !== 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limit</span>
                      <span className="font-mono">
                        {Number(ad.minLimit) === 0
                          ? `Up to ${Number(ad.maxLimit).toLocaleString()} USDT`
                          : Number(ad.maxLimit) === 0
                            ? `From ${Number(ad.minLimit).toLocaleString()} USDT`
                            : `${Number(ad.minLimit).toLocaleString()} – ${Number(ad.maxLimit).toLocaleString()} USDT`
                        }
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex flex-wrap gap-1 max-w-[60%]">
                    {ad.paymentMethods.slice(0, 3).map((method: string) => (
                      <span key={method} className={`px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${selectedPayment !== "All" && method.toLowerCase().replace(/\s+/g, "").includes(selectedPayment.toLowerCase().replace(/\s+/g, "")) ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        {method}
                      </span>
                    ))}
                    {ad.paymentMethods.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] text-muted-foreground font-medium">+{ad.paymentMethods.length - 3}</span>
                    )}
                  </div>
                  <Link href={`/p2p/confirm/${ad.id}`}>
                    <button className={`px-6 py-2 rounded-md font-semibold text-sm ${type === "buy" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                      {type === "buy" ? "Buy" : "Sell"} USDT
                    </button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
