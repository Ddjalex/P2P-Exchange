import { AppLayout } from "@/components/layout";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedbackItem {
  id: number;
  type: "positive" | "negative";
  comment: string | null;
  fromUsername: string;
  fromUserId: number;
  orderId: number;
  createdAt: string;
}

function getToken() {
  return localStorage.getItem("p2p_token");
}

export default function ReceivedFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "positive" | "negative">("all");

  useEffect(() => {
    fetch("/api/profile/feedback", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        setFeedbacks(Array.isArray(data) ? data : []);
      })
      .catch(() => setFeedbacks([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = feedbacks.filter(f => filter === "all" ? true : f.type === filter);
  const positiveCount = feedbacks.filter(f => f.type === "positive").length;
  const negativeCount = feedbacks.filter(f => f.type === "negative").length;

  return (
    <AppLayout>
      <header className="p-4 border-b border-border bg-card flex items-center space-x-3">
        <Link href="/profile">
          <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-bold text-lg">Received Feedback</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <ThumbsUp className="w-4 h-4 text-success" />
              <span className="text-xl font-bold text-success">{positiveCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">Positive</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <ThumbsDown className="w-4 h-4 text-destructive" />
              <span className="text-xl font-bold text-destructive">{negativeCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">Negative</div>
          </div>
        </div>

        <div className="flex space-x-2">
          {(["all", "positive", "negative"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {f === "all" ? `All (${feedbacks.length})` : f === "positive" ? `Positive (${positiveCount})` : `Negative (${negativeCount})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No feedback yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(fb => (
              <div key={fb.id} className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                      {fb.fromUsername.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{fb.fromUsername}</div>
                      <div className="text-[10px] text-muted-foreground">Order #{fb.orderId}</div>
                    </div>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${fb.type === "positive" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {fb.type === "positive" ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                    <span className="capitalize">{fb.type}</span>
                  </div>
                </div>
                {fb.comment && (
                  <p className="text-sm text-muted-foreground italic">"{fb.comment}"</p>
                )}
                <div className="text-[10px] text-muted-foreground mt-2">
                  {new Date(fb.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
