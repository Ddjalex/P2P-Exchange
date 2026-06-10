import { useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminPost, adminGet } from "@/lib/admin-api";
import { Send, Mail, MessageCircle, Radio, Users, CheckCircle } from "lucide-react";

const TARGETS = [
  { value: "all", label: "All Users" },
  { value: "verified", label: "KYC Verified Only" },
  { value: "unverified", label: "Unverified Only" },
];

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail, desc: "Sent to users with verified emails via Brevo" },
  { value: "telegram", label: "Telegram (Users)", icon: MessageCircle, desc: "Sent to users who connected Telegram bot" },
  { value: "telegram-channel", label: "Telegram Channel", icon: Radio, desc: "Posted to your configured Telegram channel" },
  { value: "in-app", label: "In-App Notification", icon: Send, desc: "Appears in users' notification inbox" },
];

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [channels, setChannels] = useState<string[]>(["in-app"]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const toggleChannel = (ch: string) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const loadHistory = async () => {
    if (historyLoaded) return;
    try {
      const data = await adminGet<any[]>("/notifications/history");
      setHistory(data ?? []);
      setHistoryLoaded(true);
    } catch {}
  };

  const send = async () => {
    if (!title.trim()) { setResult({ ok: false, msg: "Please enter a title." }); return; }
    if (!message.trim()) { setResult({ ok: false, msg: "Please enter a message." }); return; }
    if (channels.length === 0) { setResult({ ok: false, msg: "Select at least one channel." }); return; }

    setSending(true);
    setResult(null);
    const results: string[] = [];
    let anyError = false;

    for (const channel of channels) {
      try {
        const data = await adminPost<{ success: boolean; recipientCount: number; emailCount?: number; telegramCount?: number; error?: string }>(
          "/notifications/send",
          { title: title.trim(), message: message.trim(), target, channel }
        );
        if (data.success) {
          results.push(`${channel}: ${data.recipientCount} sent`);
        } else {
          results.push(`${channel}: ${data.error ?? "failed"}`);
          anyError = true;
        }
      } catch (e: any) {
        results.push(`${channel}: ${e.message ?? "error"}`);
        anyError = true;
      }
    }

    setSending(false);
    setResult({ ok: !anyError, msg: results.join(" • ") });
    if (!anyError) {
      setTitle("");
      setMessage("");
      setHistoryLoaded(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Broadcast Message">
        <div className="max-w-2xl space-y-5">

          {/* Compose card */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Compose Broadcast</h3>
                <p className="text-xs text-muted-foreground">Send a message to your users via multiple channels</p>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Title / Subject</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Platform Maintenance Notice"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your broadcast message here..."
                rows={5}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
              />
              <div className="text-xs text-muted-foreground text-right mt-1">{message.length} chars</div>
            </div>

            {/* Target audience */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Target Audience</label>
              <div className="flex flex-wrap gap-2">
                {TARGETS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTarget(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${target === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Send Via (select one or more)</label>
              <div className="space-y-2">
                {CHANNELS.map(ch => {
                  const Icon = ch.icon;
                  const active = channels.includes(ch.value);
                  return (
                    <button
                      key={ch.value}
                      onClick={() => toggleChannel(ch.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${active ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{ch.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{ch.desc}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? "border-primary bg-primary" : "border-border"}`}>
                        {active && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className={`px-4 py-3 rounded-lg text-sm ${result.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                {result.ok ? "✅ " : "❌ "}{result.msg}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={send}
              disabled={sending || !title.trim() || !message.trim() || channels.length === 0}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send Broadcast</>
              )}
            </button>
          </div>

          {/* Broadcast history */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Broadcasts</h3>
              <button
                onClick={loadHistory}
                className="text-xs text-primary hover:underline"
              >
                {historyLoaded ? "↻ Refresh" : "Load History"}
              </button>
            </div>
            {!historyLoaded ? (
              <p className="text-sm text-muted-foreground text-center py-6">Click "Load History" to see past broadcasts</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No broadcasts yet</p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 10).map((h: any) => (
                  <div key={h.id} className="border border-border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-sm truncate">{h.title}</div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{h.message}</div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        📬 {h.recipientCount} recipients • {h.channel}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full ${h.status === "sent" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
