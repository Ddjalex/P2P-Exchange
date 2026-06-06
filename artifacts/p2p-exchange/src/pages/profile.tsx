import { AppLayout } from "@/components/layout";
import { Edit2, ShieldCheck, HelpCircle, Info, LogOut, ChevronRight, CheckCircle2, X, Loader2 } from "lucide-react";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

const NOTIFICATION_KEYS = [
  { key: "tradeAlerts", label: "Trade Alerts" },
  { key: "chatMessages", label: "Chat Messages" },
  { key: "systemNotifications", label: "System Updates" },
  { key: "emailNotifications", label: "Email Notifications" },
  { key: "smsNotifications", label: "SMS Notifications" },
] as const;

type NotifKey = typeof NOTIFICATION_KEYS[number]["key"];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "am", label: "አማርኛ (Amharic)" },
  { code: "om", label: "Afaan Oromoo" },
  { code: "so", label: "Soomaali" },
  { code: "ti", label: "ትግርኛ (Tigrinya)" },
];

// ─── Edit Username Modal ─────────────────────────────────────────────────────
function EditUsernameModal({
  currentUsername,
  onClose,
  onSuccess,
}: { currentUsername: string; onClose: () => void; onSuccess: (newName: string) => void }) {
  const [username, setUsername] = useState(currentUsername);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSave = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (trimmed === currentUsername) { onClose(); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update username");
      toast({ title: "Username updated!" });
      onSuccess(trimmed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl overflow-y-auto max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Edit Username</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-muted-foreground">Choose a unique username (min. 3 characters).</p>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={30}
            autoFocus
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || username.trim().length < 3}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Email Modal ─────────────────────────────────────────────────────────
function AddEmailModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const sendCode = async () => {
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: email.toLowerCase().trim(), type: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("code");
      if (data.devCode) {
        setCode(data.devCode);
        toast({ title: "Dev mode: code auto-filled", description: `OTP: ${data.devCode}` });
      } else {
        toast({ title: "Verification code sent to your email" });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSave = async () => {
    if (code.length < 4) { setError("Enter the verification code"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/profile/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify");
      toast({ title: "Email added successfully!" });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl overflow-y-auto max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Add Email Address</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-muted-foreground">
            {step === "email"
              ? "Add your email to enable email notifications. We'll send a verification code."
              : `Enter the 6-digit code sent to ${email}`}
          </p>
          {step === "email" ? (
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          ) : (
            <input
              type="text"
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:border-primary"
              inputMode="numeric"
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={step === "email" ? sendCode : verifyAndSave}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Please wait...</span></>
              : <span>{step === "email" ? "Send Verification Code" : "Verify & Save"}</span>}
          </button>
          {step === "code" && (
            <button onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full text-sm text-muted-foreground">
              ← Change email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Language Modal ──────────────────────────────────────────────────────────
function LanguageModal({ current, onClose, onSelect }: { current: string; onClose: () => void; onSelect: (code: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[480px] bg-card rounded-t-2xl overflow-y-auto max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Select Language</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/50"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { onSelect(lang.code); onClose(); }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${current === lang.code ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary/50"}`}
              >
                <span className="text-sm font-medium">{lang.label}</span>
                {current === lang.code && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      className={`w-10 h-5 rounded-full relative transition-colors ${on ? "bg-primary" : "bg-secondary"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
    </div>
  );
}

// ─── Profile Page ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile();
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const search = useSearch();

  const tabFromUrl = new URLSearchParams(search).get("tab");
  const initialTab: "trade" | "notifications" | "others" =
    tabFromUrl === "notifications" || tabFromUrl === "others" ? tabFromUrl : "trade";
  const [tab, setTab] = useState<"trade" | "notifications" | "others">(initialTab);
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});
  const [savingNotif, setSavingNotif] = useState<string | null>(null);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    if (profile?.notificationSettings) {
      setNotifSettings(profile.notificationSettings as Record<string, boolean>);
    }
  }, [profile]);

  const isPhoneUser = user?.email?.endsWith("@phone.xendrx.com") ?? false;
  const hasPhone = !!user?.phone;

  const handleToggleNotif = async (key: NotifKey) => {
    if (key === "emailNotifications" && isPhoneUser && !notifSettings[key]) {
      setShowAddEmail(true);
      return;
    }
    if (key === "smsNotifications" && !hasPhone && !notifSettings[key]) {
      toast({ title: "No phone number linked", description: "Register with a phone number to enable SMS notifications.", variant: "destructive" });
      return;
    }
    const newVal = !notifSettings[key];
    setNotifSettings(prev => ({ ...prev, [key]: newVal }));
    setSavingNotif(key);
    try {
      const res = await fetch("/api/profile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ [key]: newVal }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    } catch {
      setNotifSettings(prev => ({ ...prev, [key]: !newVal }));
      toast({ title: "Failed to save setting", variant: "destructive" });
    } finally {
      setSavingNotif(null);
    }
  };

  const handleEmailAdded = async () => {
    setShowAddEmail(false);
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    await handleToggleNotif("emailNotifications");
  };

  const handleUsernameUpdated = async (newName: string) => {
    setShowEditUsername(false);
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const currentLangLabel = LANGUAGES.find(l => l.code === language)?.label ?? "English";
  const displayUsername = profile?.username || user?.username || "?";

  return (
    <AppLayout>
      <header className="p-6 border-b border-border bg-card">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <Skeleton className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-xl font-bold">
                {displayUsername.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                {isLoading ? <Skeleton className="h-6 w-24" /> : (
                  <h1 className="font-bold text-xl">{displayUsername}</h1>
                )}
                <button
                  onClick={() => setShowEditUsername(true)}
                  className="p-1 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex items-center">
                {profile?.kycStatus === "verified" ? (
                  <><ShieldCheck className="w-4 h-4 text-success mr-1" /><span className="text-success font-medium">Verified User</span></>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-1" />Unverified</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mb-6">
          {[
            { label: "Email", verified: profile?.emailVerified },
            { label: "SMS", verified: profile?.smsVerified },
            { label: "KYC", verified: profile?.kycStatus === "verified" },
            { label: "Address", verified: profile?.addressVerified },
          ].map(({ label, verified }) => (
            <div key={label} className="flex flex-col items-center space-y-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${verified ? "bg-success/10 border-success/30 text-success" : "bg-secondary border-border text-muted-foreground"}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          ) : (
            <>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">30d Trades</div>
                <div className="font-bold font-mono">{profile?.trades30d ?? 0} Time(s)</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">30d Completion Rate</div>
                <div className="font-bold font-mono">{profile?.completionRate30d ?? "0.00%"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Avg. Release Time</div>
                <div className="font-bold font-mono">{profile?.avgReleaseTime ?? "0.00"} Min</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Avg. Pay Time</div>
                <div className="font-bold font-mono">{profile?.avgPayTime ?? "0.00"} Min</div>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex border-b border-border">
        {(["trade", "notifications", "others"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
            <Link href="/profile/feedback" className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Received Feedback</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link href="/profile/follows" className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Follows</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link href="/profile/blocked" className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">Blocked Users</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        )}

        {tab === "notifications" && (
          <div className="bg-card rounded-xl border border-card-border p-4 space-y-4">
            {NOTIFICATION_KEYS.map(({ key, label }) => {
              const isOn = !!notifSettings[key];
              const isSaving = savingNotif === key;
              const isEmailDisabled = key === "emailNotifications" && isPhoneUser && !profile?.emailVerified && !isOn;
              const isSmsDisabled = key === "smsNotifications" && !hasPhone;

              return (
                <div key={key} className="flex justify-between items-center pb-4 border-b border-border last:border-0 last:pb-0">
                  <div>
                    <span className="text-sm">{label}</span>
                    {isEmailDisabled && <div className="text-[10px] text-muted-foreground mt-0.5">Add email to enable</div>}
                    {isSmsDisabled && <div className="text-[10px] text-muted-foreground mt-0.5">Phone number required</div>}
                  </div>
                  {isSaving ? (
                    <div className="w-10 h-5 rounded-full bg-secondary animate-pulse" />
                  ) : (
                    <Toggle on={isOn} onChange={() => handleToggleNotif(key)} disabled={isSmsDisabled} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "others" && (
          <div className="bg-card rounded-xl overflow-hidden border border-card-border">
            <button
              onClick={() => setShowLang(true)}
              className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors"
            >
              <span className="text-sm font-medium">Language</span>
              <span className="text-xs text-muted-foreground flex items-center">{currentLangLabel}<ChevronRight className="w-4 h-4 ml-1" /></span>
            </button>
            <Link href="/help-center" className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium flex items-center"><HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />Help Center</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link href="/about" className="flex items-center justify-between p-4 border-b border-border hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium flex items-center"><Info className="w-4 h-4 mr-2 text-muted-foreground" />About Xendrx</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center p-4 hover:bg-secondary/50 transition-colors text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-sm font-bold">Logout</span>
            </button>
          </div>
        )}
      </div>

      {showEditUsername && (
        <EditUsernameModal
          currentUsername={displayUsername}
          onClose={() => setShowEditUsername(false)}
          onSuccess={handleUsernameUpdated}
        />
      )}
      {showAddEmail && (
        <AddEmailModal onClose={() => setShowAddEmail(false)} onSuccess={handleEmailAdded} />
      )}
      {showLang && (
        <LanguageModal current={language} onClose={() => setShowLang(false)} onSelect={setLanguage} />
      )}
    </AppLayout>
  );
}
