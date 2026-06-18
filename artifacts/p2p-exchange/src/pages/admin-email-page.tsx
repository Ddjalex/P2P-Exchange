import { useState, useEffect, useRef } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import { Mail, Search, Send, X, User, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

interface EmailUser {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  kycStatus: string;
}

interface EmailSend {
  id: number;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  sentAt: string;
  userId: number | null;
}

export default function AdminEmailPage() {
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmailUser[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [history, setHistory] = useState<EmailSend[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminGet<EmailUser[]>("/email/users")
      .then(data => setUsers(data ?? []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }).filter(u => !selected.find(s => s.id === u.id));

  function selectUser(u: EmailUser) {
    setSelected(prev => [...prev, u]);
    setSearch("");
    setDropdownOpen(false);
  }

  function removeUser(id: number) {
    setSelected(prev => prev.filter(u => u.id !== id));
  }

  async function handleSend() {
    if (selected.length === 0) { setResult({ ok: false, msg: "Select at least one recipient." }); return; }
    if (!subject.trim()) { setResult({ ok: false, msg: "Subject is required." }); return; }
    if (!body.trim()) { setResult({ ok: false, msg: "Message body is required." }); return; }

    setSending(true);
    setResult(null);
    try {
      const data = await adminPost<{ success: boolean; sent: number; failed: number; error?: string }>(
        "/email/send",
        { userIds: selected.map(u => u.id), subject: subject.trim(), body: body.trim() }
      );
      if (data.success) {
        setResult({ ok: true, msg: `Email sent to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.` });
        setSelected([]);
        setSubject("");
        setBody("");
        setHistoryLoaded(false);
      } else {
        setResult({ ok: false, msg: data.error ?? "Failed to send." });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message ?? "Network error." });
    } finally {
      setSending(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await adminGet<EmailSend[]>("/email/history");
      setHistory(data ?? []);
      setHistoryLoaded(true);
    } catch {}
    finally { setHistoryLoading(false); }
  }

  const canSend = selected.length > 0 && subject.trim() && body.trim() && !sending;

  return (
    <AdminGuard>
      <AdminLayout title="Email Users">
        <div className="max-w-2xl space-y-5">

          {/* Compose card */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Send Email</h3>
                <p className="text-xs text-muted-foreground">Send a custom email to specific users via Brevo</p>
              </div>
            </div>

            {/* Recipient selector */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Recipients
                <span className="ml-2 text-primary">{users.length} users with email</span>
              </label>

              {/* Selected chips */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selected.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{u.username}</span>
                      <span className="text-primary/60 hidden sm:inline">({u.email})</span>
                      <button onClick={() => removeUser(u.id)} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search / dropdown */}
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={usersLoading ? "Loading users…" : "Search by username or email…"}
                    value={search}
                    onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    disabled={usersLoading}
                  />
                </div>
                {dropdownOpen && search && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                    {filteredUsers.slice(0, 20).map(u => (
                      <button
                        key={u.id}
                        onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.username}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        {u.emailVerified && (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" title="Email verified" />
                        )}
                      </button>
                    ))}
                    {filteredUsers.length > 20 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                        {filteredUsers.length - 20} more — narrow your search
                      </div>
                    )}
                  </div>
                )}
                {dropdownOpen && search && filteredUsers.length === 0 && !usersLoading && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-xl">
                    <div className="px-4 py-3 text-sm text-muted-foreground text-center">No matching users with email</div>
                  </div>
                )}
              </div>

              {selected.length === 0 && !usersLoading && (
                <p className="text-xs text-muted-foreground mt-1.5">Only users who registered with email or have a verified email are shown.</p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Important update about your account"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Message Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your email message here…"
                rows={6}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
              />
              <div className="text-xs text-muted-foreground text-right mt-1">{body.length} chars</div>
            </div>

            {/* Result */}
            {result && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${result.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                {result.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {result.msg}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send Email{selected.length > 1 ? ` to ${selected.length} Users` : selected.length === 1 ? " to 1 User" : ""}</>
              )}
            </button>
          </div>

          {/* History */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Send History</h3>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${historyLoading ? "animate-spin" : ""}`} />
                {historyLoaded ? "Refresh" : "Load History"}
              </button>
            </div>

            {!historyLoaded ? (
              <p className="text-sm text-muted-foreground text-center py-6">Click "Load History" to see past emails</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No emails sent yet</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} className="border border-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-sm truncate">{h.subject}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${h.status === "sent" ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {h.status === "sent" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {h.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{h.toEmail}</span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{h.body}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(h.sentAt).toLocaleString()}
                    </div>
                    {h.error && (
                      <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">Error: {h.error}</div>
                    )}
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
