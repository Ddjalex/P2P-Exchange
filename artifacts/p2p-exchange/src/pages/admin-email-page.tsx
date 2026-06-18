import { useState, useEffect, useRef } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPost } from "@/lib/admin-api";
import {
  Mail, Search, Send, X, User, CheckCircle, Clock,
  AlertCircle, RefreshCw, Users, ShieldCheck, Filter,
} from "lucide-react";

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

type Tab = "users" | "compose" | "history";
type VerifiedFilter = "all" | "verified" | "unverified";

export default function AdminEmailPage() {
  const [users, setUsers] = useState<EmailUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("users");

  // User table filters
  const [tableSearch, setTableSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("all");

  // Recipient selector for compose
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmailUser[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Compose
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // History
  const [history, setHistory] = useState<EmailSend[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

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

  const verifiedUsers = users.filter(u => u.emailVerified);
  const unverifiedUsers = users.filter(u => !u.emailVerified);

  const filteredTable = users.filter(u => {
    const q = tableSearch.toLowerCase();
    const matchesSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesFilter =
      verifiedFilter === "all" ||
      (verifiedFilter === "verified" && u.emailVerified) ||
      (verifiedFilter === "unverified" && !u.emailVerified);
    return matchesSearch && matchesFilter;
  });

  const filteredDropdown = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      !selected.find(s => s.id === u.id)
    );
  });

  function selectUser(u: EmailUser) {
    setSelected(prev => [...prev, u]);
    setSearch("");
    setDropdownOpen(false);
  }

  function removeUser(id: number) {
    setSelected(prev => prev.filter(u => u.id !== id));
  }

  function selectAllVerified() {
    const unselectedVerified = verifiedUsers.filter(u => !selected.find(s => s.id === u.id));
    setSelected(prev => [...prev, ...unselectedVerified]);
  }

  function selectAll() {
    setSelected([...users]);
  }

  function clearSelected() {
    setSelected([]);
  }

  function addFromTable(u: EmailUser) {
    if (!selected.find(s => s.id === u.id)) {
      setSelected(prev => [...prev, u]);
    }
    setTab("compose");
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
        <div className="max-w-3xl space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{usersLoading ? "…" : users.length}</div>
                <div className="text-xs text-muted-foreground">Total with Email</div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">{usersLoading ? "…" : verifiedUsers.length}</div>
                <div className="text-xs text-muted-foreground">Verified Email</div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-400">{usersLoading ? "…" : unverifiedUsers.length}</div>
                <div className="text-xs text-muted-foreground">Unverified Email</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {([
              { id: "users", label: "User Table", icon: Users },
              { id: "compose", label: `Compose${selected.length > 0 ? ` (${selected.length})` : ""}`, icon: Mail },
              { id: "history", label: "Send History", icon: Clock },
            ] as { id: Tab; label: string; icon: any }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* ── USER TABLE TAB ── */}
          {tab === "users" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Table toolbar */}
              <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search username or email…"
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
                  {(["all", "verified", "unverified"] as VerifiedFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setVerifiedFilter(f)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${verifiedFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-3 px-4 py-2.5 border-b border-border bg-background/50">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</div>
              </div>

              {/* Table rows */}
              {usersLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Loading users…
                </div>
              ) : filteredTable.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No users found</div>
              ) : (
                <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                  {filteredTable.map(u => {
                    const isSelected = !!selected.find(s => s.id === u.id);
                    return (
                      <div
                        key={u.id}
                        className={`grid grid-cols-[1fr_1.5fr_auto_auto] gap-3 px-4 py-3 items-center transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/50"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium truncate">{u.username}</span>
                          {u.kycStatus === "verified" && (
                            <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" title="KYC Verified" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                        <div>
                          {u.emailVerified ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium whitespace-nowrap">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium whitespace-nowrap">
                              <AlertCircle className="w-3 h-3" /> Unverified
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => addFromTable(u)}
                          disabled={isSelected}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isSelected ? "bg-primary/10 text-primary cursor-default" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                        >
                          {isSelected ? "Added ✓" : "Select"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2 bg-background/30">
                <span className="text-xs text-muted-foreground">
                  Showing {filteredTable.length} of {users.length} users
                  {selected.length > 0 && <span className="text-primary ml-2">· {selected.length} selected</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllVerified}
                    disabled={usersLoading || verifiedUsers.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle className="w-3 h-3" /> All Verified ({verifiedUsers.length})
                  </button>
                  <button
                    onClick={selectAll}
                    disabled={usersLoading || users.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-40"
                  >
                    <Users className="w-3 h-3" /> All ({users.length})
                  </button>
                  {selected.length > 0 && (
                    <button
                      onClick={clearSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                  {selected.length > 0 && (
                    <button
                      onClick={() => setTab("compose")}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Mail className="w-3 h-3" /> Compose →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── COMPOSE TAB ── */}
          {tab === "compose" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Compose Email</h3>
                  <p className="text-xs text-muted-foreground">Send a custom email via Brevo</p>
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Recipients
                  {selected.length > 0 && (
                    <span className="ml-2 text-primary font-medium">{selected.length} selected</span>
                  )}
                </label>

                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selected.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">
                        {u.emailVerified
                          ? <CheckCircle className="w-3 h-3 text-green-400" />
                          : <User className="w-3 h-3" />
                        }
                        <span className="font-medium">{u.username}</span>
                        <button onClick={() => removeUser(u.id)} className="hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div ref={dropdownRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Add more recipients…"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                      onFocus={() => setDropdownOpen(true)}
                      className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    />
                  </div>
                  {dropdownOpen && search && filteredDropdown.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {filteredDropdown.slice(0, 20).map(u => (
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
                          {u.emailVerified && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={selectAllVerified} disabled={verifiedUsers.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 disabled:opacity-40">
                    <CheckCircle className="w-3 h-3" /> All Verified ({verifiedUsers.length})
                  </button>
                  <button onClick={selectAll} disabled={users.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-40">
                    <Users className="w-3 h-3" /> All ({users.length})
                  </button>
                  {selected.length > 0 && (
                    <button onClick={clearSelected}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
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

              {result && (
                <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${result.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                  {result.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  {result.msg}
                </div>
              )}

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
          )}

          {/* ── HISTORY TAB ── */}
          {tab === "history" && (
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
                <p className="text-sm text-muted-foreground text-center py-8">Click "Load History" to see past emails</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No emails sent yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-sm truncate">{h.subject}</div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${h.status === "sent" ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {h.status === "sent" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {h.status}
                        </span>
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
          )}

        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
