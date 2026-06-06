import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { Send } from "lucide-react";

const TELEGRAM_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export default function AdminNotificationsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [target, setTarget] = useState("all");
  const [channel, setChannel] = useState("in-app");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [tgStats, setTgStats] = useState<{ connected: number } | null>(null);

  const loadHistory = () => adminGet<any[]>("/notifications/history").then(setHistory).catch(() => {});
  const loadTgStats = () => adminGet<{ connected: number }>("/telegram/stats").then(setTgStats).catch(() => {});

  useEffect(() => {
    loadHistory();
    loadTgStats();
  }, []);

  const send = async () => {
    if (!title.trim() || !message.trim()) { alert("Title and message are required."); return; }
    setSending(true);
    setResult(null);
    try {
      const r = await adminPost<any>("/notifications/send", { target, channel, title, message });
      if (channel === "telegram") {
        setResult(`✓ Sent to ${r.telegramCount} Telegram users`);
      } else if (channel === "in-app+telegram") {
        setResult(`✓ Sent to ${r.recipientCount} users (${r.telegramCount} via Telegram)`);
      } else {
        setResult(`✓ Sent to ${r.recipientCount} recipients`);
      }
      setTitle(""); setMessage("");
      loadHistory();
    } catch (e: any) {
      setResult(`✗ ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const isTelegram = channel === "telegram" || channel === "in-app+telegram";

  return (
    <AdminGuard>
      <AdminLayout title="Notifications">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Send panel */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Send Notification</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Target</label>
                <select value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                  <option value="all">All Users</option>
                  <option value="verified">Verified Users Only</option>
                  <option value="unverified">Unverified Users</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">
                  <option value="in-app">In-App Only</option>
                  <option value="in-app+telegram">In-App + Telegram</option>
                  <option value="telegram">Telegram Only</option>
                </select>
                {isTelegram && tgStats !== null && (
                  <div className="mt-1.5 flex items-center space-x-1.5 text-[11px] text-[#229ed9]">
                    {TELEGRAM_ICON}
                    <span>{tgStats.connected} users have Telegram connected</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Message <span className="text-muted-foreground">({message.length}/500)</span></label>
                <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 500))} placeholder="Notification content..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none h-28 outline-none focus:border-primary" />
              </div>

              {result && (
                <div className={`p-3 rounded-lg text-sm font-medium ${result.startsWith('✓') ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>{result}</div>
              )}

              <button onClick={send} disabled={sending} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                {isTelegram ? <span className="text-[#229ed9]">{TELEGRAM_ICON}</span> : <Send className="w-4 h-4" />}
                <span>{sending ? "Sending..." : isTelegram ? "Broadcast to Telegram" : "Send Notification"}</span>
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border font-semibold text-sm">Notification History</div>
            <div className="overflow-y-auto max-h-[500px]">
              {history.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No notifications sent yet</div>
              ) : history.map(h => (
                <div key={h.id} className="p-4 border-b border-border/50">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm">{h.title}</div>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(h.sentAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{h.message}</p>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span>Target: {h.target}</span>
                    <span className="flex items-center space-x-0.5">
                      {(h.channel === "telegram" || h.channel === "in-app+telegram") && (
                        <span className="text-[#229ed9] mr-0.5">{TELEGRAM_ICON}</span>
                      )}
                      <span>Channel: {h.channel}</span>
                    </span>
                    <span>{h.recipientCount} recipients</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${h.status === 'sent' ? 'bg-success/20 text-success' : 'bg-muted'}`}>{h.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Automated toggles */}
        <div className="mt-5 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 text-sm">Automated Notifications</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "KYC approved/rejected → email + in-app",
              "Order created → in-app",
              "Payment marked → in-app + email",
              "Order completed → in-app + email",
              "Dispute raised → in-app + email",
              "Dispute resolved → in-app + email",
              "Withdrawal approved/rejected → email + in-app",
              "System maintenance → all users",
            ].map(item => (
              <label key={item} className="flex items-center space-x-3 p-3 bg-background rounded-lg border border-border cursor-pointer">
                <div className="w-9 h-5 bg-success rounded-full flex items-center justify-end px-0.5 flex-shrink-0">
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
                <span className="text-xs text-muted-foreground">{item}</span>
              </label>
            ))}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
