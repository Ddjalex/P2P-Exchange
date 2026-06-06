import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

export default function TransferHistoryPage() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["transfer-history"],
    queryFn: () =>
      fetch("/api/wallet/transfer-history", {
        headers: { Authorization: `Bearer ${getToken()}` },
      }).then(r => r.json()),
  });

  const transfers: any[] = data?.transfers || [];

  return (
    <AppLayout>
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => navigate("/wallet")} className="p-1 hover:bg-secondary/50 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">Transfer History</h1>
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📤</div>
            <div className="text-muted-foreground text-sm">No transfers yet</div>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((t: any) => (
              <div key={t.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{
                    background: t.isSender ? "rgba(255,100,100,0.15)" : "rgba(0,212,255,0.15)",
                  }}
                >
                  {t.isSender ? "📤" : "📥"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {t.isSender
                      ? `Sent to ${t.receiverUsername}`
                      : `Received from ${t.senderUsername}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    UID: {t.isSender ? t.receiverUid : t.senderUid}
                    {t.note ? ` • ${t.note}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className="font-mono font-bold text-sm flex-shrink-0"
                  style={{ color: t.isSender ? "#ff6b6b" : "#00d4ff" }}
                >
                  {t.isSender ? "-" : "+"}{Number(t.amount).toFixed(4)} USDT
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
