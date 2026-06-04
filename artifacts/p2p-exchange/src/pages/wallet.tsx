import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { Bell, Settings, Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, X, Copy, Check, Loader2, AlertCircle, ChevronDown, SendHorizonal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

// ─── Deposit Modal ───────────────────────────────────────────────────────────

function DepositModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"initiate" | "send">("initiate");
  const [network] = useState<"TRC20">("TRC20");
  const [fromAddress, setFromAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [minDeposit, setMinDeposit] = useState("1");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleInitiate = async () => {
    setError("");
    if (!fromAddress.trim() || fromAddress.trim().length < 10) {
      setError("Please enter your sending wallet address (the TRC20 address you will send FROM).");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Please enter the amount you want to deposit.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fromAddress: fromAddress.trim(), amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register deposit");
      setBusinessAddress(data.depositAddress ?? "");
      setMinDeposit(minDeposit);
      setStep("send");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!businessAddress) return;
    await navigator.clipboard.writeText(businessAddress);
    setCopied(true);
    toast({ title: "Address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl overflow-y-auto max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">Deposit USDT</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "initiate" ? "Step 1 of 2 — Register your deposit" : "Step 2 of 2 — Send your USDT"}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1: User enters their sending address + amount */}
          {step === "initiate" && (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">How it works</p>
                <p>Enter your TRC20 wallet address (the one you will send <strong>from</strong>) and the amount. We will register this so your deposit is automatically credited when it arrives on-chain.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Your Sending Wallet Address (TRC20) *
                  </label>
                  <input
                    value={fromAddress}
                    onChange={e => setFromAddress(e.target.value)}
                    placeholder="T... (the address you will send FROM)"
                    className="w-full px-3 py-3 bg-secondary border border-border rounded-xl text-sm font-mono outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This is your wallet address on Binance, OKX, or any exchange/wallet.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Amount to Deposit (USDT) *
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 100"
                    min="1"
                    className="w-full px-3 py-3 bg-secondary border border-border rounded-xl text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleInitiate}
                disabled={loading}
                className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Registering..." : "Continue →"}
              </button>
            </>
          )}

          {/* Step 2: Show business address to send to */}
          {step === "send" && (
            <>
              <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-success">✓ Deposit registered</p>
                <p className="text-muted-foreground">Send exactly <span className="font-mono font-bold text-foreground">{amount} USDT (TRC20)</span> from <span className="font-mono break-all">{fromAddress}</span> to the address below. Your balance will be credited automatically.</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Send USDT ({network}) to this address</label>
                {businessAddress ? (
                  <div className="bg-secondary rounded-xl p-4 space-y-3">
                    <p className="text-sm font-mono break-all leading-relaxed">{businessAddress}</p>
                    <button
                      onClick={copyAddress}
                      className="w-full flex items-center justify-center space-x-2 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? "Copied!" : "Copy Address"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">Deposit address not configured. Please contact support.</p>
                  </div>
                )}
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-warning">⚠️ Important</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Only send <strong>USDT (TRC20)</strong> to this address</li>
                  <li>Send from <strong>exactly the address you registered</strong> above</li>
                  <li>Send <strong>exactly {amount} USDT</strong> for automatic matching</li>
                  <li>Credited after blockchain confirmation (~1–3 min)</li>
                </ul>
              </div>

              <button
                onClick={() => setStep("initiate")}
                className="w-full py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Start over with different address/amount
              </button>

              <ReportMissedDeposit />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportMissedDeposit() {
  const [open, setOpen] = useState(false);
  const [txid, setTxid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submit = async () => {
    if (!txid.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/wallet/deposit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ txid: txid.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Failed to submit" });
      } else {
        setResult({ ok: true, message: data.message ?? "Submitted for review" });
        setTxid("");
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
      >
        <span>Didn't receive your deposit?</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            If your deposit was sent over 10 minutes ago and hasn't arrived, paste the transaction hash (txid) from your exchange below. An admin will verify and credit your wallet within 24 hours.
          </p>
          <div className="flex gap-2">
            <input
              value={txid}
              onChange={e => setTxid(e.target.value)}
              placeholder="Paste transaction hash (txid)..."
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono outline-none focus:border-primary"
            />
            <button
              onClick={submit}
              disabled={!txid.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-40 transition-opacity"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
              Submit
            </button>
          </div>
          {result && (
            <div className={`text-xs p-3 rounded-lg ${result.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Withdraw Modal ──────────────────────────────────────────────────────────

function WithdrawModal({
  availableBalance,
  onClose,
  onSuccess,
}: {
  availableBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [network, setNetwork] = useState<"TRC20" | "ERC20">("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const avail = parseFloat(availableBalance || "0");
  const amt = parseFloat(amount || "0");
  const fee = amt > 0 ? (amt * 0.001).toFixed(4) : "0";
  const youGet = amt > 0 ? Math.max(0, amt - parseFloat(fee)).toFixed(4) : "0";

  const handleSetMax = () => setAmount(avail.toFixed(2));

  const handleWithdraw = async () => {
    setError("");
    if (!address.trim()) { setError("Enter a destination wallet address"); return; }
    if (amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > avail) { setError("Insufficient available balance"); return; }
    if (amt < 1) { setError("Minimum withdrawal is 1 USDT"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ address: address.trim(), network, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      toast({ title: "Withdrawal submitted!", description: "Your request is being processed." });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl overflow-y-auto max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Withdraw USDT</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Select Network</label>
            <div className="grid grid-cols-2 gap-2">
              {(["TRC20", "ERC20"] as const).map(net => (
                <button
                  key={net}
                  onClick={() => setNetwork(net)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${network === net ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"}`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Destination Address ({network})</label>
            <input
              type="text"
              placeholder="Paste wallet address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Amount (USDT)</label>
              <span className="text-xs text-muted-foreground">
                Available: <span className="text-foreground font-medium">{avail.toLocaleString()} USDT</span>
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                max={avail}
                step="0.01"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 pr-16 text-sm font-mono focus:outline-none focus:border-primary placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSetMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-bold hover:underline"
              >
                MAX
              </button>
            </div>
          </div>

          {amt > 0 && (
            <div className="bg-secondary rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Network Fee (0.1%)</span>
                <span className="font-mono">{fee} USDT</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>You Receive</span>
                <span className="font-mono text-primary">{youGet} USDT</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            onClick={handleWithdraw}
            disabled={loading || !address || amt <= 0 || amt > avail}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Submitting...</span></>
            ) : (
              <><ArrowUpFromLine className="w-4 h-4" /><span>Confirm Withdrawal</span></>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground pb-2">
            Minimum withdrawal: 1 USDT · Processing time: ~30 minutes
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wallet Page ────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user } = useAuth();
  const { data: wallet, isLoading } = useGetWallet();
  const [showBalance, setShowBalance] = useState(true);
  const [, setLocation] = useLocation();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const queryClient = useQueryClient();

  const handleWithdrawSuccess = () => {
    setShowWithdraw(false);
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
  };

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex space-x-4 text-lg">
          <button className="text-white font-bold">Wallet</button>
          <button onClick={() => setLocation("/p2p")} className="text-muted-foreground font-medium">P2P</button>
        </div>
        <div className="flex items-center space-x-4 text-muted-foreground">
          <Bell className="w-5 h-5" />
          <Settings className="w-5 h-5" />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {user?.kycStatus !== "verified" && (
          <div
            className={`p-3 rounded-lg border flex flex-col space-y-2 ${
              user?.kycStatus === "rejected"
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : user?.kycStatus === "more_info_required"
                ? "bg-orange/10 border-orange/20 text-orange"
                : "bg-warning/10 border-warning/20 text-warning"
            }`}
          >
            <div className="text-sm font-medium">
              {user?.kycStatus === "none" && "Complete identity verification to start trading"}
              {user?.kycStatus === "pending" && "Verification under review — we'll notify you shortly"}
              {user?.kycStatus === "rejected" && "KYC Rejected — Resubmit your documents"}
              {user?.kycStatus === "more_info_required" && "Action Required — Update your submission"}
            </div>
            {user?.kycStatus === "none" && <Link href="/kyc" className="text-sm underline font-semibold">Verify Now</Link>}
            {user?.kycStatus === "rejected" && <Link href="/kyc" className="text-sm underline font-semibold">Resubmit</Link>}
            {user?.kycStatus === "more_info_required" && <Link href="/kyc" className="text-sm underline font-semibold">Update</Link>}
          </div>
        )}

        <div className="p-5 rounded-xl bg-card border border-card-border space-y-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Total Balance</span>
            <button onClick={() => setShowBalance(!showBalance)}>
              {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-1">
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <div className="text-3xl font-bold font-mono">
                {showBalance ? `${Number(wallet?.totalBalance || 0).toLocaleString()} USDT` : "*****"}
              </div>
            )}
            {isLoading ? <Skeleton className="h-5 w-24" /> : (
              <div className="text-sm text-muted-foreground">
                {showBalance ? `≈ ${Number(wallet?.etbValue || 0).toLocaleString()} ETB` : "*****"}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <Button
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => setShowDeposit(true)}
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Deposit
            </Button>
            <Button
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => setShowWithdraw(true)}
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Assets</h2>
          <Link href="/wallet/usdt" className="flex items-center justify-between p-4 rounded-xl bg-card border border-card-border hover:bg-muted/50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#26A17B]/20 flex items-center justify-center">
                <span className="text-[#26A17B] font-bold text-sm">₮</span>
              </div>
              <div>
                <div className="font-semibold">USDT</div>
                <div className="text-xs text-muted-foreground">Tether US</div>
              </div>
            </div>
            <div className="text-right">
              {isLoading ? <Skeleton className="h-5 w-16 mb-1" /> : (
                <div className="font-mono font-medium">{showBalance ? Number(wallet?.totalBalance || 0).toLocaleString() : "***"}</div>
              )}
              {isLoading ? <Skeleton className="h-4 w-12" /> : (
                <div className="text-xs text-muted-foreground">{showBalance ? `≈ ${Number(wallet?.etbValue || 0).toLocaleString()} Br` : "***"}</div>
              )}
            </div>
          </Link>
        </div>
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && (
        <WithdrawModal
          availableBalance={wallet?.availableBalance ?? "0"}
          onClose={() => setShowWithdraw(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </AppLayout>
  );
}
