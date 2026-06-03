import { AppLayout } from "@/components/layout";
import { Edit2, ShieldCheck, Settings, HelpCircle, Info, LogOut, ChevronRight, CheckCircle2 } from "lucide-react";
import { useGetProfile, useGetStatsOverview, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile();
  const { data: stats } = useGetStatsOverview();
  const [tab, setTab] = useState<"trade" | "notifications" | "others">("trade");
  const { user } = useAuth();

  return (
    <AppLayout>
      <header className="p-6 border-b border-border bg-card">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-xl font-bold">
              {profile?.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-xl">{profile?.username || user?.username}</h1>
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex items-center">
                {profile?.kycStatus === "verified" ? (
                  <><ShieldCheck className="w-4 h-4 text-success mr-1" /> <span className="text-success font-medium">Verified User</span></>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-1" /> Unverified</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mb-6">
          {['Email', 'SMS', 'KYC', 'Address'].map((badge) => {
            const isVerified = badge === 'Email' ? profile?.emailVerified : 
                               badge === 'SMS' ? profile?.smsVerified : 
                               badge === 'KYC' ? profile?.kycStatus === 'verified' : 
                               profile?.addressVerified;
            return (
              <div key={badge} className="flex flex-col items-center space-y-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isVerified ? "bg-success/10 border-success/30 text-success" : "bg-secondary border-border text-muted-foreground"}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-muted-foreground">{badge}</span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">30d Trades</div>
            <div className="font-bold font-mono">{profile?.trades30d || 0} Time(s)</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">30d Completion Rate</div>
            <div className="font-bold font-mono">{profile?.completionRate30d || "0.00"}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Avg. Release Time</div>
            <div className="font-bold font-mono">{profile?.avgReleaseTime || "0.00"} Min</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Avg. Pay Time</div>
            <div className="font-bold font-mono">{profile?.avgPayTime || "0.00"} Min</div>
          </div>
        </div>
      </header>

      <div className="flex border-b border-border">
        {["trade", "notifications", "others"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-2">
        {tab === "trade" && (
          <div className="bg-card rounded-xl overflow-hidden border border-card-border">
            <Link href="/profile/payment-methods" className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Payment Methods</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Received Feedback</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Follows</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Blocked Users</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {tab === "notifications" && (
          <div className="bg-card rounded-xl border border-card-border p-4 space-y-4">
            {['Trade Alerts', 'Chat Messages', 'System Updates', 'Email Notifications', 'SMS Notifications'].map((item, i) => (
              <div key={item} className="flex justify-between items-center pb-4 border-b border-border last:border-0 last:pb-0">
                <span className="text-sm">{item}</span>
                <div className={`w-10 h-5 rounded-full ${i < 3 ? 'bg-primary' : 'bg-secondary'} relative transition-colors cursor-pointer`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${i < 3 ? 'left-5' : 'left-0.5'}`}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "others" && (
          <div className="bg-card rounded-xl overflow-hidden border border-card-border">
            <div className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Language</span>
              <span className="text-xs text-muted-foreground flex items-center">English <ChevronRight className="w-4 h-4 ml-1" /></span>
            </div>
            <div className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium flex items-center"><HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" /> Help Center</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium flex items-center"><Info className="w-4 h-4 mr-2 text-muted-foreground" /> About EthioP2P</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center p-4 hover:bg-secondary/50 transition-colors cursor-pointer text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-sm font-bold">Logout</span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}