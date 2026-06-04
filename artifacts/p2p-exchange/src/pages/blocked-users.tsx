import { AppLayout } from "@/components/layout";
import { ArrowLeft, Ban, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface BlockedItem {
  id: number;
  blockedId: number;
  username: string;
  createdAt: string;
}

function getToken() {
  return localStorage.getItem("p2p_token");
}

export default function BlockedUsersPage() {
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/profile/blocked", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => setBlocked(Array.isArray(data) ? data : []))
      .catch(() => setBlocked([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleUnblock = async (blockedId: number, username: string) => {
    setUnblocking(blockedId);
    try {
      const res = await fetch(`/api/profile/blocked/${blockedId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed");
      setBlocked(prev => prev.filter(b => b.blockedId !== blockedId));
      toast({ title: `Unblocked ${username}` });
    } catch {
      toast({ title: "Failed to unblock", variant: "destructive" });
    } finally {
      setUnblocking(null);
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
        <h1 className="font-bold text-lg">Blocked Users</h1>
        <span className="ml-auto text-sm text-muted-foreground">{blocked.length} users</span>
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : blocked.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No blocked users</p>
            <p className="text-xs mt-1">Blocked users won't be able to trade with you</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocked.map(b => (
              <div key={b.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {b.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{b.username}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Blocked {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(b.blockedId, b.username)}
                  disabled={unblocking === b.blockedId}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{unblocking === b.blockedId ? "..." : "Unblock"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
