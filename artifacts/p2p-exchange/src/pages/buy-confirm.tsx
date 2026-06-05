import { AppLayout } from "@/components/layout";
import { ArrowLeft, X, AlertCircle } from "lucide-react";
import { useGetAd } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
  const { data: ad, isLoading } = useGetAd(Number(adId), { query: { enabled: !!adId } });

  const [etbAmount, setEtbAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = ad ? parseFloat(ad.price) : 0;
  const usdtAmount = etbAmount && price > 0 ? (parseFloat(etbAmount) / price).toFixed(4) : "0.0000";

  const handleMax = () => {
    if (!ad) return;
    setEtbAmount(ad.maxLimit.toString());
  };

  const handleClearEtb = () => { setEtbAmount(""); setError(null); };

  const canBuy =
    etbAmount &&
    parseFloat(etbAmount) >= parseFloat(ad?.minLimit ?? "0") &&
    parseFloat(etbAmount) <= parseFloat(ad?.maxLimit ?? "0") &&
    selectedPayment;

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
          amountUsdt: usdtAmount,
          amountEtb: etbAmount,
          paymentMethod: selectedPayment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong");
        setCreating(false);
        return;
      }
      navigate(`/trade/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setCreating(false);
    }
  };

  if (isLoading || !ad) {
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

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={() => navigate("/p2p")} className="mr-3">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold">Buy USDT</h1>
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

        {/* ETB Amount Input */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground block mb-2">I want to pay</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={etbAmount}
              onChange={e => { setEtbAmount(e.target.value); setError(null); }}
              placeholder="Enter amount"
              className="flex-1 bg-transparent text-xl font-bold outline-none min-w-0"
            />
            {etbAmount && (
              <button onClick={handleClearEtb}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={handleMax}
              className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold flex-shrink-0"
            >
              Max
            </button>
            <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-bold text-muted-foreground flex-shrink-0">
              ETB
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Limit Br {Number(ad.minLimit).toLocaleString()} – Br {Number(ad.maxLimit).toLocaleString()} &nbsp;|&nbsp; Time Limit {ad.paymentTimeLimit} min
          </p>
        </div>

        {/* USDT Received */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs text-muted-foreground block mb-2">I will receive</label>
          <div className="flex items-center space-x-2">
            <span className="flex-1 text-xl font-bold font-mono">{usdtAmount}</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-bold text-muted-foreground flex-shrink-0">
              USDT
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Price: {Number(ad.price).toLocaleString()} ETB/USDT
          </p>
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
          <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wide">Seller Information</p>
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
        {etbAmount && (
          parseFloat(etbAmount) < parseFloat(ad.minLimit) ||
          parseFloat(etbAmount) > parseFloat(ad.maxLimit)
        ) && (
          <p className="text-xs text-destructive px-1">
            Amount must be between Br {Number(ad.minLimit).toLocaleString()} and Br {Number(ad.maxLimit).toLocaleString()}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border sm:max-w-[480px] sm:mx-auto">
        <button
          onClick={handleBuy}
          disabled={!canBuy || creating}
          className="w-full py-3.5 rounded-full font-bold text-white text-base bg-success disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {creating ? "Creating Order..." : "Buy USDT"}
        </button>
      </div>
    </AppLayout>
  );
}
