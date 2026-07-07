import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { Settings, Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, X, Copy, Check, Loader2, AlertCircle, Send, Lock } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { Link, useLocation } from "wouter";
import { useGetWallet, getGetWalletQueryKey, useGetMe } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { NATIONALITY_TO_CURRENCY, getFiatCurrency } from "@/constants/currencies";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { InternalTransferPanel } from "@/components/internal-transfer";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

// ─── Deposit Modal ───────────────────────────────────────────────────────────

function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const network = "BEP20";
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

  const fetchAddress = async () => {
    setAddrLoading(true);
    setAddrError("");
    setAddress("");
    try {
      const res = await fetch(`/api/wallet/deposit-address?network=${network}`, {
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

  useEffect(() => { fetchAddress(); }, []);

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

  const networkLabel = "BEP20 (BSC)";
  const networkExplorer = "bscscan.com";

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
          {/* Network badge */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Network</label>
            <div className="py-2.5 px-4 rounded-xl text-sm font-semibold border bg-primary/10 border-primary text-primary w-fit">
              BEP20 (BSC)
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
                <li>Only send <strong>USDT (BEP20)</strong> — other tokens will be lost</li>
                <li>Minimum deposit: <strong>{minDeposit} USDT</strong></li>
                <li>Use the <strong>BNB Smart Chain (BSC)</strong> network only</li>
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
                  {txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim()) && txHash.trim().length >= 10 && (
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
  minWithdrawal,
  withdrawalFeeBEP20,
  onClose,
  onSuccess,
}: {
  availableBalance: string;
  minWithdrawal: number;
  withdrawalFeeBEP20: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"external" | "internal">("external");
  const network = "BEP20";
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const avail = parseFloat(availableBalance || "0");
  const amt = parseFloat(amount || "0");
  const fee = withdrawalFeeBEP20;
  const youGet = amt > 0 ? Math.max(0, amt - fee).toFixed(4) : "0";

  const handleSetMax = () => setAmount(avail.toFixed(2));

  const handleWithdraw = async () => {
    setError("");
    if (!address.trim()) { setError("Enter a destination wallet address"); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) { setError("Enter a valid BEP20 (BSC) address starting with 0x"); return; }
    if (amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > avail) { setError("Insufficient available balance"); return; }
    if (amt < minWithdrawal) { setError(`Minimum withdrawal is ${minWithdrawal} USDT`); return; }

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
          <h2 className="font-bold text-lg">{mode === "internal" ? "Internal Transfer" : "Withdraw USDT"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl">
            <button
              onClick={() => setMode("external")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "external" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              External
            </button>
            <button
              onClick={() => setMode("internal")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "internal" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <Send className="w-3.5 h-3.5" />
              Internal
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-8 space-y-5" style={{ WebkitOverflowScrolling: "touch" }}>

          {/* Internal Transfer mode */}
          {mode === "internal" && (
            <InternalTransferPanel availableBalance={availableBalance} />
          )}

          {/* External Withdrawal mode */}
          {mode === "external" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Network</label>
                <div className="py-2.5 px-4 rounded-xl text-sm font-semibold border bg-primary/10 border-primary text-primary w-fit">
                  BEP20 (BSC)
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Destination Address (BEP20)</label>
                <input
                  type="text"
                  placeholder="0x... (BSC address)"
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
                    <span>Network Fee (fixed)</span>
                    <span className="font-mono">{fee.toFixed(4)} USDT</span>
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
                Minimum withdrawal: {minWithdrawal} USDT · Processing time: ~30 minutes
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  , document.body);
}

// ─── Main Wallet Page ────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user } = useAuth();
  const { data: me } = useGetMe();
  const { data: wallet, isLoading } = useGetWallet();
  const [showBalance, setShowBalance] = useState(true);

  // Derive user's fiat currency from their country (ISO-2 code)
  const userFiatCode = NATIONALITY_TO_CURRENCY[me?.country ?? user?.country ?? "ET"] ?? "ETB";
  const userFiat = getFiatCurrency(userFiatCode);
  const fiatSymbol = userFiat?.symbol ?? userFiatCode;
  const [, setLocation] = useLocation();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showWithdrawSuspended, setShowWithdrawSuspended] = useState(false);
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
          <button onClick={() => setLocation("/card")} className="text-muted-foreground font-medium">Card</button>
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
            <div>
              <span className="text-sm">Total Balance</span>
              {user?.uid && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">UID:</span>
                  <span className="text-[10px] font-mono text-muted-foreground/80">{user.uid}</span>
                  <button
                    className="text-[10px] text-primary/60 hover:text-primary"
                    onClick={() => navigator.clipboard.writeText(user.uid!).then(() => {})}
                    title="Copy UID"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>
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
                {showBalance
                  ? `≈ ${(Number(wallet?.totalBalance || 0) * Number(wallet?.etbRate || 0)).toLocaleString()} ${userFiatCode}`
                  : "*****"}
              </div>
            )}
            {!isLoading && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-mono font-medium text-foreground">
                    {showBalance ? `${Number(wallet?.availableBalance || 0).toLocaleString()} USDT` : "*****"}
                  </span>
                </div>
                {Number(wallet?.frozenBalance || 0) > 0 && (
                  <Link href="/orders" className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity">
                    <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                    <span className="text-muted-foreground">Frozen:</span>
                    <span className="font-mono font-medium text-warning">
                      {showBalance ? `${Number(wallet?.frozenBalance || 0).toLocaleString()} USDT` : "*****"}
                    </span>
                  </Link>
                )}
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
              onClick={() => {
                if (user?.withdrawalSuspended) {
                  setShowWithdrawSuspended(true);
                } else {
                  setShowWithdraw(true);
                }
              }}
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Assets</h2>
          <div
            role="button"
            onClick={() => setLocation("/wallet/usdt")}
            className="flex items-center justify-between p-4 rounded-xl bg-card border border-card-border hover:bg-muted/50 transition-colors cursor-pointer"
          >
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
                <div className="text-xs text-muted-foreground">
                  {showBalance
                    ? Number(wallet?.frozenBalance || 0) > 0
                      ? <span
                          className="text-warning/80 hover:text-warning hover:underline underline-offset-2 transition-colors"
                          onClick={e => { e.stopPropagation(); setLocation("/orders"); }}
                        >🔒 {Number(wallet?.frozenBalance || 0).toLocaleString()} frozen</span>
                      : `≈ ${(Number(wallet?.totalBalance || 0) * Number(wallet?.etbRate || 0)).toLocaleString()} ${userFiatCode}`
                    : "***"}
                </div>
              )}
            </div>
          </div>
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
          minWithdrawal={parseFloat((wallet as any)?.minWithdrawal ?? "10")}
          withdrawalFeeBEP20={parseFloat((wallet as any)?.withdrawalFeeBEP20 ?? "2.5")}
          onClose={() => setShowWithdraw(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
      {showWithdrawSuspended && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={() => setShowWithdrawSuspended(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-[480px] bg-card rounded-t-2xl p-8 flex flex-col items-center text-center space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-bold text-lg">Withdrawals Unavailable</h3>
            <p className="text-sm text-muted-foreground">
              Withdrawals are currently unavailable for your account.
              Please contact support for assistance.
            </p>
            <button
              onClick={() => setShowWithdrawSuspended(false)}
              className="w-full py-4 bg-secondary text-foreground font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
