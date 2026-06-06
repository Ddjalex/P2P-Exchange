import { AppLayout } from "@/components/layout";
import { ArrowLeft, X, AlertCircle } from "lucide-react";
import { useGetAd } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const PM_COLORS: Record<string, string> = {
  "Tele Birr": "bg-red-500",
  "Telebirr": "bg-red-500",
  "CBE": "bg-blue-600",
  "Awash Bank": "bg-yellow-500",
  "Abyssinia Bank": "bg-green-600",
  "Dashen Bank": "bg-purple-600",
};

function PaymentMethodDot({ method }: { method: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${PM_COLORS[method] ?? "bg-primary"} mr-1.5 flex-shrink-0`} />;
}

export default function BuyConfirmPage() {
  const { adId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: ad, isLoading } = useGetAd(Number(adId), { query: { enabled: !!adId } });

  const { data: feeData } = useQuery({
    queryKey: ["fees"],
    queryFn: () => fetch("/api/fees").then(r => r.json()),
    staleTime: 60_000,
  });

  const makerFeePercent: number = feeData?.makerFeePercent ?? 0.20;
  const takerFeePercent: number = feeData?.takerFeePercent ?? 0.10;
  const totalFeePercent: number = makerFeePercent + takerFeePercent;

  const [inputMode, setInputMode] = useState<"ETB" | "USDT">("ETB");
  const [inputValue, setInputValue] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };

  const price = ad ? safeNum(ad.price) : 0;
  const minLimit = safeNum(ad?.minLimit);
  const maxLimit = safeNum(ad?.maxLimit);
  const available = safeNum(ad?.availableAmount);

  const inputNum = parseFloat(inputValue) || 0;
  const usdtNum = inputMode === "ETB" ? (price > 0 ? inputNum / price : 0) : inputNum;
  const etbNum  = inputMode === "USDT" ? inputNum * price : inputNum;
  const usdtDisplay = usdtNum > 0 ? usdtNum.toFixed(4) : "0.0000";
  const etbDisplay  = etbNum > 0  ? etbNum.toFixed(2)  : "0.00";

  const feeUsdt = usdtNum * totalFeePercent / 100;
  const netUsdt = usdtNum - feeUsdt;

  const handleToggle = () => {
    setInputMode(m => m === "ETB" ? "USDT" : "ETB");
    setInputValue("");
    setError(null);
  };

  const handleMax = () => {
    if (!ad) return;
    if (inputMode === "USDT") {
      const maxUsdt = maxLimit > 0 ? Math.min(maxLimit, available) : available;
      setInputValue(maxUsdt > 0 ? String(maxUsdt) : "");
    } else {
      const maxUsdt = maxLimit > 0 ? Math.min(maxLimit, available) : available;
      const maxEtb = maxUsdt * price;
      setInputValue(maxEtb > 0 ? maxEtb.toFixed(2) : "");
    }
  };

  const handleClear = () => { setInputValue(""); setError(null); };

  const withinLimits =
    (minLimit === 0 || usdtNum >= minLimit) &&
    (maxLimit === 0 || usdtNum <= maxLimit);

  const canBuy = inputValue && usdtNum > 0 && withinLimits && selectedPayment;

  const handleBuy = async () => {
    if (!ad || !canBuy || !selectedPayment) return;
    setCreating(true);
    setError(null);
    try {
      const token = localStorage.getItem("p2p_token");
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          adId: ad.id,
          amountUsdt: usdtDisplay,
          amountEtb: etbDisplay,
          paymentMethod: selectedPayment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.message || "Something went wrong";
        if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("balance")) {
          setError("This seller no longer has sufficient balance. Please choose another ad.");
          setTimeout(() => navigate("/p2p"), 3000);
        } else {
          setError(msg);
        }
        setCreating(false);
        return;
      }
      navigate(`/trade/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout showNav={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (ad && user && (ad as any).userId === user.id) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center p-4 border-b border-border">
          <button onClick={() => navigate("/p2p")} className="mr-3">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">Trade Offer</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
          <span className="text-5xl">🪞</span>
          <h2 className="font-bold text-lg">This is your own ad</h2>
          <p className="text-sm text-muted-foreground">You cannot trade with yourself.</p>
          <button onClick={() => navigate("/p2p")} className="text-primary font-medium text-sm">
            Browse other ads →
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!ad) {
    return (
      <AppLayout showNav={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  const paymentMethods: string[] = ad.paymentMethods ?? [];

  // When the ad type is "buy", the ad poster wants to BUY — so the current user is SELLING
  const isSelling = ad.type === "buy";
  const actionLabel = isSelling ? "Sell USDT" : "Buy USDT";
  const counterpartyLabel = isSelling ? "Buyer Information" : "Seller Information";

  const limitText = (() => {
    if (minLimit === 0 && maxLimit === 0) return null;
    if (minLimit === 0) return `Up to ${maxLimit.toLocaleString()} USDT`;
    if (maxLimit === 0) return `From ${minLimit.toLocaleString()} USDT`;
    return `Limit ${minLimit.toLocaleString()} – ${maxLimit.toLocaleString()} USDT`;
  })();

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={() => navigate("/p2p")} className="mr-3">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold">{actionLabel}</h1>
          <p className="text-xs text-muted-foreground">P2P Order Confirmation</p>
        </div>
      </header>

      <div className="p-4 pb-32 space-y-4">
        {/* Error banner */}
        {error && (
          <div className="flex items-start space-x-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="flex-shrink-0">
              <X className="w-4 h-4 text-destructive/70" />
            </button>
          </div>
        )}

        {/* Amount Input */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground block mb-2">
            {isSelling
              ? (inputMode === "USDT" ? "I want to send" : "I want to receive")
              : (inputMode === "ETB" ? "I want to pay" : "I want to receive")}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setError(null); }}
              placeholder="Enter amount"
              className="flex-1 bg-transparent text-xl font-bold outline-none min-w-0"
            />
            {inputValue && (
              <button onClick={handleClear}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={handleMax}
              className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold flex-shrink-0"
            >
              Max
            </button>
            <button
              onClick={handleToggle}
              title="Tap to switch input currency"
              className="px-2.5 py-1 rounded-md bg-primary/20 text-primary text-xs font-bold flex-shrink-0 border border-primary/30 hover:bg-primary/30 transition-colors"
            >
              {inputMode}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {limitText ? `${limitText}  |  ` : ""}Time Limit {ad.paymentTimeLimit} min
          </p>
        </div>

        {/* I will receive — with fee breakdown */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground block mb-2">
            {isSelling
              ? (inputMode === "USDT" ? "I will receive" : "I will send")
              : (inputMode === "ETB" ? "I will receive" : "I will pay")}
          </label>
          {inputMode === "ETB" ? (
            <>
              <div className="flex items-center space-x-2 mb-1">
                <span className="flex-1 text-2xl font-bold font-mono text-foreground">
                  {netUsdt > 0 ? netUsdt.toFixed(4) : "0.0000"}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-bold text-muted-foreground flex-shrink-0">
                  USDT
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Price: {Number(ad.price).toLocaleString()} ETB/USDT
              </p>
              {usdtNum > 0 && (
                <div className="border-t border-border pt-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[11px]">Gross amount</span>
                    <span className="text-foreground text-[11px]">{usdtNum.toFixed(4)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[11px]">Maker fee ({makerFeePercent}%)</span>
                    <span className="text-orange-400 text-[11px]">-{(usdtNum * makerFeePercent / 100).toFixed(4)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[11px]">Taker fee ({takerFeePercent}%)</span>
                    <span className="text-orange-400 text-[11px]">-{(usdtNum * takerFeePercent / 100).toFixed(4)} USDT</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1">
                    <span className="text-primary text-[12px] font-semibold">You receive</span>
                    <span className="text-primary text-[12px] font-bold">{netUsdt.toFixed(4)} USDT</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <span className="flex-1 text-xl font-bold font-mono">{etbDisplay}</span>
                <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-bold text-muted-foreground flex-shrink-0">
                  ETB
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Price: {Number(ad.price).toLocaleString()} ETB/USDT
              </p>
            </>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3">Payment Method</p>
          <div className="space-y-2">
            {paymentMethods.map(method => (
              <button
                key={method}
                onClick={() => { setSelectedPayment(method); setError(null); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl border transition-colors ${selectedPayment === method ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <PaymentMethodDot method={method} />
                <span className="text-sm font-medium flex-1 text-left">{method}</span>
                {selectedPayment === method && (
                  <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Seller Information */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wide">{counterpartyLabel}</p>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
              {ad.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold">{ad.username}</span>
                {ad.isMerchant && (
                  <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-bold">✓ Verified</span>
                )}
                <span className="px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold">Online</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {[
              ["30D Transactions", `${ad.orderCount}`],
              ["30D Completion Rate", ad.completionRate],
              ["Available", `${Number(ad.availableAmount).toLocaleString()} USDT`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Advertiser Terms */}
        {ad.autoReply && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Advertiser Terms</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{ad.autoReply}</p>
          </div>
        )}

        {/* Validation warning */}
        {inputValue && usdtNum > 0 && !withinLimits && (
          <p className="text-xs text-destructive px-1">
            {minLimit > 0 && maxLimit > 0
              ? `Amount must be between ${minLimit.toLocaleString()} and ${maxLimit.toLocaleString()} USDT`
              : minLimit > 0
                ? `Minimum amount is ${minLimit.toLocaleString()} USDT`
                : `Maximum amount is ${maxLimit.toLocaleString()} USDT`
            }
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
        <button
          onClick={handleBuy}
          disabled={!canBuy || creating}
          className={`w-full py-3.5 rounded-full font-bold text-white text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${isSelling ? "bg-destructive" : "bg-success"}`}
        >
          {creating ? "Creating Order..." : actionLabel}
        </button>
      </div>
    </AppLayout>
  );
}
