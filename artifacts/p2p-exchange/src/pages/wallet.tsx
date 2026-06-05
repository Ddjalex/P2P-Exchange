import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { Settings, Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, X, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { Link, useLocation } from "wouter";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

// ─── Deposit Modal ───────────────────────────────────────────────────────────

type DepositNetwork = "TRC20" | "BEP20";

/** Detect blockchain from tx hash format:
 *  - 0x + 64 hex chars → BEP20 (EVM / BSC)
 *  - 64 hex chars, no 0x prefix → TRC20 (TRON)
 */
function detectNetwork(hash: string): DepositNetwork | null {
  const h = hash.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(h)) return "BEP20";
  if (/^[0-9a-fA-F]{64}$/.test(h)) return "TRC20";
  return null;
}

function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [network, setNetwork] = useState<DepositNetwork>("BEP20");
  const [autoDetected, setAutoDetected] = useState<DepositNetwork | null>(null);
  const [address, setAddress] = useState("");
  const [minDeposit, setMinDeposit] = useState("1");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState("");
  const [copied, setCopied] = useState(false);

  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verified, setVerified] = useState<{ amount: string; message: string } | null>(null);

  const { toast } = useToast();

  const fetchAddress = async (net: DepositNetwork) => {
    setAddrLoading(true);
    setAddrError("");
    setAddress("");
    try {
      const res = await fetch(`/api/wallet/deposit-address?network=${net}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load address");
      setAddress(data.address);
      setMinDeposit(data.minDeposit ?? "1");
    } catch (e: any) {
      setAddrError(e.message);
    } finally {
      setAddrLoading(false);
    }
  };

  useEffect(() => { fetchAddress(network); }, [network]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast({ title: "Address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTxHashChange = (val: string) => {
    setTxHash(val);
    setVerifyError("");
    const detected = detectNetwork(val);
    setAutoDetected(detected);
    if (detected && detected !== network) {
      setNetwork(detected);
      setVerified(null);
    }
  };

  const handleVerify = async () => {
    setVerifyError("");
    if (!txHash.trim() || txHash.trim().length < 10) {
      setVerifyError("Paste the full transaction hash from your exchange.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/wallet/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ txHash: txHash.trim(), network }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setVerified({ amount: data.amount, message: data.message });
      onSuccess();
    } catch (e: any) {
      setVerifyError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const networkLabel = network === "BEP20" ? "BEP20 (BSC)" : "TRC20 (TRON)";
  const networkExplorer = network === "BEP20" ? "bscscan.com" : "tronscan.org";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl flex flex-col"
        style={{ maxHeight: "85dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Pinned header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="font-bold text-lg">Deposit USDT</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-8 space-y-5" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Network selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Select Network</label>
              {autoDetected && (
                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                  ✓ Auto-detected: {autoDetected === "BEP20" ? "BEP20 (BSC)" : "TRC20 (TRON)"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["BEP20", "TRC20"] as const).map(net => (
                <button
                  key={net}
                  onClick={() => { setNetwork(net); setAutoDetected(null); setVerified(null); setVerifyError(""); setTxHash(""); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${network === net ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"}`}
                >
                  {net === "BEP20" ? "BEP20 (BSC)" : "TRC20 (TRON)"}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Show deposit address */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-black text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <label className="text-sm font-medium">Send USDT ({networkLabel}) to this address</label>
            </div>

            {addrLoading ? (
              <div className="flex items-center justify-center h-16 bg-secondary rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : addrError ? (
              <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{addrError}</p>
              </div>
            ) : (
              <div className="bg-secondary rounded-xl p-4 space-y-3">
                <p className="text-sm font-mono break-all leading-relaxed select-all">{address}</p>
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "Copied!" : "Copy Address"}</span>
                </button>
              </div>
            )}

            <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-warning">⚠️ Important</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Only send <strong>USDT ({network})</strong> — other tokens will be lost</li>
                <li>Minimum deposit: <strong>{minDeposit} USDT</strong></li>
                <li>Use the <strong>correct network</strong> ({networkLabel})</li>
              </ul>
            </div>
          </div>

          {/* Step 2: Paste TX hash and verify */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-black text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <label className="text-sm font-medium">After sending, paste the transaction hash</label>
            </div>

            {verified ? (
              <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center space-y-1">
                <p className="text-lg font-bold text-success">✓ Deposit Verified!</p>
                <p className="text-sm text-foreground font-semibold">{parseFloat(verified.amount).toFixed(2)} USDT credited to your wallet</p>
                <p className="text-xs text-muted-foreground">{verified.message}</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    value={txHash}
                    onChange={e => handleTxHashChange(e.target.value)}
                    placeholder="Paste TX hash — network auto-detected"
                    className="w-full px-3 py-3 bg-secondary border border-border rounded-xl text-sm font-mono outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
                  />
                  {txHash && !autoDetected && txHash.trim().length >= 10 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warning">
                      ?
                    </span>
                  )}
                </div>

                {verifyError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{verifyError}</p>
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={verifying || !txHash.trim()}
                  className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {verifying ? "Verifying..." : "Verify"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  , document.body);
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
  const [network] = useState<"TRC20">("TRC20");
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl flex flex-col"
        style={{ maxHeight: "85dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Pinned header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="font-bold text-lg">Withdraw USDT</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-8 space-y-5" style={{ WebkitOverflowScrolling: "touch" }}>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Network</label>
            <div className="py-2.5 px-4 rounded-xl text-sm font-semibold border bg-primary/10 border-primary text-primary w-fit">
              TRC20 (TRON)
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Destination Address (TRC20)</label>
            <input
              type="text"
              placeholder="T... (TRON address)"
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
  , document.body);
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

  const handleDepositSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
  };

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
          <NotificationBell />
          <Link href="/profile?tab=others">
            <Settings className="w-5 h-5 hover:text-foreground transition-colors cursor-pointer" />
          </Link>
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

      {showDeposit && (
        <DepositModal
          onClose={() => setShowDeposit(false)}
          onSuccess={handleDepositSuccess}
        />
      )}
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
