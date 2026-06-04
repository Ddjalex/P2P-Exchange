import { AppLayout } from "@/components/layout";
import { ArrowLeft, Users, ShieldCheck, UserMinus } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface FollowItem {
  id: number;
  followedId: number;
  username: string;
  kycStatus: string;
  createdAt: string;
}

function getToken() {
  return localStorage.getItem("p2p_token");
}

export default function FollowsPage() {
  const [follows, setFollows] = useState<FollowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unfollowing, setUnfollowing] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    setIsLoading(true);
    fetch("/api/profile/follows", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => setFollows(Array.isArray(data) ? data : []))
      .catch(() => setFollows([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUnfollow = async (followedId: number, username: string) => {
    setUnfollowing(followedId);
    try {
      const res = await fetch(`/api/profile/follows/${followedId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed");
      setFollows(prev => prev.filter(f => f.followedId !== followedId));
      toast({ title: `Unfollowed ${username}` });
    } catch {
      toast({ title: "Failed to unfollow", variant: "destructive" });
    } finally {
      setUnfollowing(null);
    }
  };

  return (
    <AppLayout>
      <header className="p-4 border-b border-border bg-card flex items-center space-x-3">
        <Link href="/profile">
          <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-bold text-lg">Follows</h1>
        <span className="ml-auto text-sm text-muted-foreground">{follows.length} users</span>
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : follows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">You're not following anyone yet</p>
            <p className="text-xs mt-1">Follow traders from their profiles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {follows.map(f => (
              <div key={f.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                    {f.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-medium">{f.username}</span>
                      {f.kycStatus === "verified" && (
                        <ShieldCheck className="w-3.5 h-3.5 text-success" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Following since {new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnfollow(f.followedId, f.username)}
                  disabled={unfollowing === f.followedId}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>{unfollowing === f.followedId ? "..." : "Unfollow"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
