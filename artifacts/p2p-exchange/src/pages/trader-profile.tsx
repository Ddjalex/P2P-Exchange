import { AppLayout } from "@/components/layout";
import { ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TraderProfile {
  id: number;
  username: string;
  kycStatus: string;
  isMerchant: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  registeredDays: number;
  verifications: { email: boolean; sms: boolean; kyc: boolean; address: boolean };
  isFollowing: boolean;
  stats: {
    trades30d: number;
    completionRate30d: string;
    avgReleaseTimeMinutes: string;
    avgPayTimeMinutes: string;
    allTrades: number;
    buyTrades: number;
    sellTrades: number;
    tradingCounterparties: number;
    firstTradeAt: string | null;
    positiveFeedback: number;
    negativeFeedback: number;
  };
  ads: {
    id: number;
    type: string;
    price: string;
    availableAmount: string;
    minLimit: string;
    maxLimit: string;
    paymentMethods: string[];
    paymentTimeLimit: number;
  }[];
  feedback: {
    id: number;
    fromUserId: number;
    fromUsername: string;
    type: string;
    comment: string | null;
    createdAt: string;
  }[];
}

function lastSeenText(lastActiveAt: string | null): string {
  if (!lastActiveAt) return "a while ago";
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min(s) ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour(s) ago`;
  const days = Math.floor(hours / 24);
  return `${days} day(s) ago`;
}

export default function TraderProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "ads" | "feedback">("info");
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/users/${userId}/profile`)
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setFollowing(data.isFollowing);
      })
      .catch(() => toast({ title: "Failed to load profile", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = async () => {
    if (!userId) return;
    setFollowLoading(true);
    try {
      if (following) {
        const res = await fetch(`/api/profile/follows/${userId}`, { method: "DELETE" });
        if (res.ok) { setFollowing(false); toast({ title: "Unfollowed" }); }
      } else {
        const res = await fetch(`/api/profile/follows/${userId}`, { method: "POST" });
        if (res.ok) { setFollowing(true); toast({ title: "Following" }); }
      }
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!userId) return;
    if (!confirm("Block this user? Their ads will be hidden from you.")) return;
    try {
      const res = await fetch(`/api/profile/blocked/${userId}`, { method: "POST" });
      if (res.ok) { toast({ title: "User blocked" }); navigate("/p2p"); }
      else toast({ title: "Failed to block", variant: "destructive" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <AppLayout showNav={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout showNav={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <p className="text-muted-foreground text-sm">Trader not found.</p>
          <button onClick={() => navigate(-1 as any)} className="mt-4 text-primary text-sm underline">Go back</button>
        </div>
      </AppLayout>
    );
  }

  const totalFeedback = profile.stats.positiveFeedback + profile.stats.negativeFeedback;
  const positiveRate = totalFeedback > 0 ? Math.round((profile.stats.positiveFeedback / totalFeedback) * 100) : 100;
  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={() => navigate(-1 as any)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm">Trader Profile</span>
        <div className="w-5" />
      </header>

      <div className="p-4 pb-6 space-y-4">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl font-bold text-foreground">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center justify-center space-x-1.5">
              <span className="text-xl font-bold">{profile.username}</span>
              {profile.isMerchant && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-semibold">Merchant</span>
              )}
            </div>
            <div className="flex items-center justify-center space-x-1 mt-0.5 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              <span>Last seen {lastSeenText(profile.lastActiveAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-xs mt-1">
            {profile.verifications.email && (
              <span className="flex items-center space-x-1 text-success">
                <CheckCircle className="w-3 h-3" /><span>Email</span>
              </span>
            )}
            {profile.verifications.sms && (
              <span className="flex items-center space-x-1 text-success">
                <CheckCircle className="w-3 h-3" /><span>SMS</span>
              </span>
            )}
            {profile.verifications.kyc && (
              <span className="flex items-center space-x-1 text-success">
                <CheckCircle className="w-3 h-3" /><span>KYC</span>
              </span>
            )}
            {profile.verifications.address && (
              <span className="flex items-center space-x-1 text-success">
                <CheckCircle className="w-3 h-3" /><span>Address</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <ThumbsUp className="w-3 h-3 text-success" />
            <span>{positiveRate}% positive · {totalFeedback} reviews</span>
          </div>
        </div>

        {!isOwnProfile && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              following
                ? "bg-secondary text-foreground border border-border"
                : "bg-warning/20 text-warning border border-warning/40"
            }`}
          >
            {followLoading ? "..." : following ? "Following ✓" : "+ Follow"}
          </button>
        )}

        <div className="flex border-b border-border">
          {(["info", "ads", "feedback"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              {t === "ads" ? `Ads (${profile.ads.length})` : t === "feedback" ? `Feedback (${totalFeedback})` : "Info"}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <StatRow label="30d Trades" value={String(profile.stats.trades30d)} />
              <StatRow label="30d Completion Rate" value={profile.stats.completionRate30d} />
              <StatRow label="Avg. Release Time" value={`${profile.stats.avgReleaseTimeMinutes} min`} />
              <StatRow label="Avg. Pay Time" value={`${profile.stats.avgPayTimeMinutes} min`} />
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <StatRow label="Registered" value={`${profile.registeredDays} day(s) ago`} />
              {profile.stats.firstTradeAt && (
                <StatRow
                  label="First Trade"
                  value={`${Math.floor((Date.now() - new Date(profile.stats.firstTradeAt).getTime()) / (1000 * 60 * 60 * 24))} day(s) ago`}
                />
              )}
              <StatRow label="Trading Counterparties" value={String(profile.stats.tradingCounterparties)} />
              <div className="p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">All Trades</span>
                  <span className="font-semibold">{profile.stats.allTrades}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span />
                  <span>Buy {profile.stats.buyTrades} | Sell {profile.stats.sellTrades}</span>
                </div>
              </div>
            </div>

            {!isOwnProfile && (
              <button
                onClick={handleBlock}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-destructive border border-destructive/40 bg-destructive/5"
              >
                Block
              </button>
            )}
          </div>
        )}

        {tab === "ads" && (
          <div className="space-y-3">
            {profile.ads.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">No active ads</div>
            ) : (
              profile.ads.map(ad => (
                <div key={ad.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ad.type === "sell" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {ad.type === "sell" ? "Sell USDT" : "Buy USDT"}
                    </span>
                    <span className="text-lg font-bold font-mono text-primary">
                      {Number(ad.price).toLocaleString()} <span className="text-xs text-muted-foreground">Br</span>
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Available</span>
                      <span className="text-foreground font-mono">{Number(ad.availableAmount).toLocaleString()} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limit</span>
                      <span className="text-foreground font-mono">{Number(ad.minLimit).toLocaleString()} – {Number(ad.maxLimit).toLocaleString()} Br</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ad.paymentMethods.map((m: string) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 bg-secondary rounded-full text-foreground">{m}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-3">
            {profile.feedback.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">No feedback yet</div>
            ) : (
              profile.feedback.map(fb => (
                <div key={fb.id} className="bg-card border border-border rounded-xl p-3 flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {fb.fromUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{fb.fromUsername}</span>
                      {fb.type === "positive"
                        ? <ThumbsUp className="w-4 h-4 text-success flex-shrink-0" />
                        : <ThumbsDown className="w-4 h-4 text-destructive flex-shrink-0" />
                      }
                    </div>
                    {fb.comment && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{fb.comment}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
