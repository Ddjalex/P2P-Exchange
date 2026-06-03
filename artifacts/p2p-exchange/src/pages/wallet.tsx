import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { Bell, Settings, Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Link } from "wouter";
import { useGetWallet } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function WalletPage() {
  const { user } = useAuth();
  const { data: wallet, isLoading } = useGetWallet();
  const [showBalance, setShowBalance] = useState(true);

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="font-bold text-xl tracking-tight">EthioP2P</h1>
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
            {user?.kycStatus === "none" && (
              <Link href="/kyc" className="text-sm underline font-semibold">Verify Now</Link>
            )}
            {user?.kycStatus === "rejected" && (
              <Link href="/kyc" className="text-sm underline font-semibold">Resubmit</Link>
            )}
            {user?.kycStatus === "more_info_required" && (
              <Link href="/kyc" className="text-sm underline font-semibold">Update</Link>
            )}
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
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold font-mono">
                {showBalance ? `${Number(wallet?.totalBalance || 0).toLocaleString()} USDT` : "*****"}
              </div>
            )}
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <div className="text-sm text-muted-foreground">
                {showBalance ? `≈ ${Number(wallet?.etbValue || 0).toLocaleString()} ETB` : "*****"}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Deposit
            </Button>
            <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80">
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
              {isLoading ? (
                <Skeleton className="h-5 w-16 mb-1" />
              ) : (
                <div className="font-mono font-medium">{showBalance ? Number(wallet?.totalBalance || 0).toLocaleString() : "***"}</div>
              )}
              {isLoading ? (
                <Skeleton className="h-4 w-12" />
              ) : (
                <div className="text-xs text-muted-foreground">{showBalance ? `≈ ${Number(wallet?.etbValue || 0).toLocaleString()} Br` : "***"}</div>
              )}
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
