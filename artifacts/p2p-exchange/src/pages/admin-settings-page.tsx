import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminPost, adminPatch } from "@/lib/admin-api";

const TG_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFastsms, setShowFastsms] = useState(false);
  const [showBrevo, setShowBrevo] = useState(false);
  const [showTrongrid, setShowTrongrid] = useState(false);
  const [showBscscan, setShowBscscan] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [trongridTestStatus, setTrongridTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [bscscanTestStatus, setBscscanTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [trongridTestLoading, setTrongridTestLoading] = useState(false);
  const [bscscanTestLoading, setBscscanTestLoading] = useState(false);

  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [smsTestStatus, setSmsTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [emailTestStatus, setEmailTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [smsTestLoading, setSmsTestLoading] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);

  const [botStatus, setBotStatus] = useState<{ running: boolean; username: string | null } | null>(null);
  const [tgApplying, setTgApplying] = useState(false);
  const [tgApplyStatus, setTgApplyStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    adminGet<Record<string, string>>("/settings").then(setSettings).catch(() => {}).finally(() => setLoading(false));
    adminGet<{ running: boolean; username: string | null }>("/telegram/bot-status").then(setBotStatus).catch(() => {});
  }, []);

  const changePassword = async () => {
    if (pwNew !== pwConfirm) { setPwStatus({ ok: false, msg: "Passwords do not match" }); return; }
    if (pwNew.length < 8) { setPwStatus({ ok: false, msg: "New password must be at least 8 characters" }); return; }
    setPwSaving(true); setPwStatus(null);
    try {
      await adminPatch("/change-password", { currentPassword: pwCurrent, newPassword: pwNew });
      setPwStatus({ ok: true, msg: "Password changed successfully. Use the new password on next login." });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (e: any) {
      setPwStatus({ ok: false, msg: e.message ?? "Failed to change password" });
    }
    setPwSaving(false);
  };

  const applyTgToken = async () => {
    const token = settings["telegramBotToken"]?.trim();
    if (!token) { setTgApplyStatus({ ok: false, msg: "Paste a bot token first" }); return; }
    setTgApplying(true);
    setTgApplyStatus(null);
    try {
      const data = await adminPost<{ success: boolean; username: string; error?: string }>("/telegram/apply-token", {
        token,
        username: settings["telegramBotUsername"]?.trim() || undefined,
      });
      setBotStatus({ running: true, username: data.username });
      setTgApplyStatus({ ok: true, msg: `✅ Bot @${data.username} is now live!` });
    } catch (e: any) {
      setTgApplyStatus({ ok: false, msg: e.message ?? "Failed to start bot" });
    } finally {
      setTgApplying(false);
    }
  };

  const update = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));
  const toggle = (key: string) => update(key, settings[key] === "true" ? "false" : "true");

  const save = async () => {
    setSaving(true);
    await adminPut("/settings", settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testSms = async () => {
    if (!testPhone) return;
    setSmsTestLoading(true);
    setSmsTestStatus(null);
    try {
      const data = await adminPost<{ ok: boolean; message?: string; error?: string }>("/test-sms", { phone: testPhone });
      setSmsTestStatus({ ok: data.ok, msg: data.ok ? (data.message ?? "Sent!") : (data.error ?? "Failed") });
    } catch {
      setSmsTestStatus({ ok: false, msg: "Network error" });
    } finally {
      setSmsTestLoading(false);
    }
  };

  const testBrevo = async () => {
    if (!testEmail) return;
    setEmailTestLoading(true);
    setEmailTestStatus(null);
    try {
      const data = await adminPost<{ ok: boolean; message?: string; error?: string }>("/test-email", { email: testEmail });
      setEmailTestStatus({ ok: data.ok, msg: data.ok ? (data.message ?? "Sent!") : (data.error ?? "Failed") });
    } catch {
      setEmailTestStatus({ ok: false, msg: "Network error" });
    } finally {
      setEmailTestLoading(false);
    }
  };

  const testBlockchain = async (provider: "trongrid" | "bscscan") => {
    const key = settings[provider === "trongrid" ? "trongridApiKey" : "bscscanApiKey"] ?? "";
    if (!key.trim()) return;
    const setLoading = provider === "trongrid" ? setTrongridTestLoading : setBscscanTestLoading;
    const setStatus = provider === "trongrid" ? setTrongridTestStatus : setBscscanTestStatus;
    setLoading(true);
    setStatus(null);
    try {
      const data = await adminPost<{ ok: boolean; message?: string; error?: string }>("/test-blockchain", { provider, key: key.trim() });
      setStatus({ ok: data.ok, msg: data.ok ? (data.message ?? "OK") : (data.error ?? "Failed") });
    } catch {
      setStatus({ ok: false, msg: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AdminGuard><AdminLayout title="System Settings"><div className="text-muted-foreground">Loading...</div></AdminLayout></AdminGuard>;

  const Toggle = ({ k }: { k: string }) => (
    <button onClick={() => toggle(k)} className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${settings[k] === "true" ? 'bg-success justify-end' : 'bg-border justify-start'}`}>
      <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
    </button>
  );

  const SecretInput = ({ k, show, onToggle }: { k: string; show: boolean; onToggle: () => void }) => (
    <div className="relative flex-1">
      <input
        type={show ? "text" : "password"}
        value={settings[k] ?? ""}
        onChange={e => update(k, e.target.value)}
        placeholder="Enter API key…"
        className="w-full px-3 py-1.5 pr-9 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
      >
        {show ? "hide" : "show"}
      </button>
    </div>
  );

  return (
    <AdminGuard>
      <AdminLayout title="System Settings">
        <div className="space-y-5 max-w-2xl">
          {/* General */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">General Settings</h3>
            <div className="space-y-4">
              {[
                { label: "Platform Name", key: "platformName", type: "text" },
                { label: "Support Email", key: "supportEmail", type: "email" },
                { label: "ETB Rate (1 USDT = ? ETB)", key: "etbRate", type: "number" },
                { label: "Min Deposit (USDT)", key: "minDeposit", type: "number" },
                { label: "Min Withdrawal (USDT)", key: "minWithdrawal", type: "number" },
                { label: "Max Withdrawal/Day (USDT)", key: "maxWithdrawalPerDay", type: "number" },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-52">{f.label}</label>
                  <input type={f.type} value={settings[f.key] ?? ""} onChange={e => update(f.key, e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Maintenance Mode</span>
                <Toggle k="maintenanceMode" />
              </div>
            </div>
          </div>

          {/* SMS & Email Verification */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">SMS & Email Verification</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Integrations</span>
            </div>
            <p className="text-xs text-muted-foreground mb-5">API keys used to send OTP codes during registration. Keys are stored securely in the database.</p>

            <div className="space-y-5">
              {/* FastSMS */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">📱 FastSMS.dev</span>
                  <span className="text-xs text-muted-foreground">— Phone number verification</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-28">API Key</label>
                  <SecretInput k="fastsmsApiKey" show={showFastsms} onToggle={() => setShowFastsms(v => !v)} />
                </div>
                <div className="text-xs text-muted-foreground/60">
                  Get your key at{" "}
                  <a href="https://fastsms.dev" target="_blank" rel="noreferrer" className="text-primary hover:underline">fastsms.dev</a>
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Test your API key by sending a real SMS:</p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={e => { setTestPhone(e.target.value); setSmsTestStatus(null); }}
                      placeholder="+251912345678"
                      className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={testSms}
                      disabled={smsTestLoading || !testPhone}
                      className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      {smsTestLoading ? "Sending…" : "Test SMS"}
                    </button>
                  </div>
                  {smsTestStatus && (
                    <div className={`text-xs px-3 py-2 rounded-lg ${smsTestStatus.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {smsTestStatus.ok ? "✅ " : "❌ "}{smsTestStatus.msg}
                    </div>
                  )}
                </div>
              </div>

              {/* Brevo */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">✉️ Brevo</span>
                  <span className="text-xs text-muted-foreground">— Email verification</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-28">API Key</label>
                  <SecretInput k="brevoApiKey" show={showBrevo} onToggle={() => setShowBrevo(v => !v)} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-28">Sender Email</label>
                  <input
                    type="email"
                    value={settings["brevoSenderEmail"] ?? ""}
                    onChange={e => update("brevoSenderEmail", e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-28">Sender Name</label>
                  <input
                    type="text"
                    value={settings["brevoSenderName"] ?? ""}
                    onChange={e => update("brevoSenderName", e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="text-xs text-muted-foreground/60">
                  Get your key at{" "}
                  <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="text-primary hover:underline">brevo.com</a>
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Test your API key by sending a real email:</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={e => { setTestEmail(e.target.value); setEmailTestStatus(null); }}
                      placeholder="test@example.com"
                      className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={testBrevo}
                      disabled={emailTestLoading || !testEmail}
                      className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      {emailTestLoading ? "Sending…" : "Test Email"}
                    </button>
                  </div>
                  {emailTestStatus && (
                    <div className={`text-xs px-3 py-2 rounded-lg ${emailTestStatus.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {emailTestStatus.ok ? "✅ " : "❌ "}{emailTestStatus.msg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Blockchain API Keys */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">Blockchain API Keys</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Integrations</span>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Used to verify deposits on-chain when users paste a TX hash. Keys stored here take priority over environment variables.
            </p>

            <div className="space-y-4">
              {/* TronGrid */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">⛓ TronGrid</span>
                    <span className="text-xs text-muted-foreground">— TRC20 (TRON) verification</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${settings["trongridApiKey"] ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {settings["trongridApiKey"] ? "Configured" : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-28">API Key</label>
                  <SecretInput k="trongridApiKey" show={showTrongrid} onToggle={() => setShowTrongrid(v => !v)} />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => testBlockchain("trongrid")}
                    disabled={trongridTestLoading || !settings["trongridApiKey"]?.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {trongridTestLoading ? "Testing…" : "Test Connection"}
                  </button>
                  {trongridTestStatus && (
                    <span className={`text-xs font-medium ${trongridTestStatus.ok ? "text-success" : "text-destructive"}`}>
                      {trongridTestStatus.ok ? "✓" : "✗"} {trongridTestStatus.msg}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground/60">
                  Free tier: 2,000 req/day · Get your key at{" "}
                  <a href="https://www.trongrid.io" target="_blank" rel="noreferrer" className="text-primary hover:underline">trongrid.io</a>
                  {" "}→ Sign up → Dashboard → Create API Key
                </div>
              </div>

              {/* BSC — no key needed */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">⛓ BNB Smart Chain</span>
                    <span className="text-xs text-muted-foreground">— BEP20 (BSC) verification</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">
                    Free — no key needed
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  BEP20 deposits are verified directly via Binance's free public RPC nodes (<code className="text-primary/80">bsc-dataseed.binance.org</code>). No API key or account required.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => testBlockchain("bscscan")}
                    disabled={bscscanTestLoading}
                    className="text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {bscscanTestLoading ? "Testing…" : "Test RPC"}
                  </button>
                  {bscscanTestStatus && (
                    <span className={`text-xs font-medium ${bscscanTestStatus.ok ? "text-success" : "text-destructive"}`}>
                      {bscscanTestStatus.ok ? "✓" : "✗"} {bscscanTestStatus.msg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Bot */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#229ed9]">{TG_ICON}</span>
              <h3 className="font-semibold">Telegram Bot</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Integrations</span>
              {botStatus && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${botStatus.running ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {botStatus.running ? `🟢 Active — @${botStatus.username}` : "⚪ Inactive"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Paste your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary hover:underline">@BotFather</a> to enable Telegram notifications and broadcast messages. The token is stored securely in the database.
            </p>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-muted-foreground flex-shrink-0 w-28">Bot Token</label>
                <div className="relative flex-1">
                  <input
                    type={showTgToken ? "text" : "password"}
                    value={settings["telegramBotToken"] ?? ""}
                    onChange={e => { update("telegramBotToken", e.target.value); setTgApplyStatus(null); }}
                    placeholder="1234567890:AAF..."
                    className="w-full px-3 py-1.5 pr-9 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTgToken(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
                  >
                    {showTgToken ? "hide" : "show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-muted-foreground flex-shrink-0 w-28">Bot Username</label>
                <input
                  type="text"
                  value={settings["telegramBotUsername"] ?? ""}
                  onChange={e => update("telegramBotUsername", e.target.value)}
                  placeholder="XendrxBot"
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-muted-foreground flex-shrink-0 w-28">Channel ID</label>
                <input
                  type="text"
                  value={settings["telegramChannelId"] ?? ""}
                  onChange={e => update("telegramChannelId", e.target.value)}
                  placeholder="-1001234567890"
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground/50">Channel ID is used for broadcast messages. Forward a channel post to @userinfobot to get the ID (starts with -100).</p>

              <div className="text-xs text-muted-foreground/60 space-y-0.5">
                <p>1. Open Telegram and start a chat with <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary hover:underline">@BotFather</a></p>
                <p>2. Send <code className="text-primary/80">/newbot</code> and follow the prompts</p>
                <p>3. Copy the token and paste it above, then click Apply</p>
              </div>

              {tgApplyStatus && (
                <div className={`text-xs px-3 py-2 rounded-lg ${tgApplyStatus.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {tgApplyStatus.msg}
                </div>
              )}

              <button
                onClick={applyTgToken}
                disabled={tgApplying || !settings["telegramBotToken"]?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#229ed9]/10 text-[#229ed9] border border-[#229ed9]/30 rounded-lg text-sm font-medium hover:bg-[#229ed9]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{TG_ICON}</span>
                <span>{tgApplying ? "Connecting…" : "Apply & Activate Bot"}</span>
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Payment Methods</h3>
            <div className="space-y-2">
              {["CBE", "Telebirr", "Awash Bank", "Dashen Bank", "Abyssinia Bank", "HelloCash", "M-Pesa"].map(pm => {
                const key = `pm_${pm.toLowerCase().replace(/\s+/g, '_')}`;
                if (settings[key] === undefined) settings[key] = "true";
                return (
                  <div key={pm} className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm">{pm}</span>
                    <Toggle k={key} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Networks */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Supported Networks</h3>
            <div className="space-y-3">
              {[{ label: "BEP20 (BSC)", key: "bep20Enabled" }, { label: "TRC20 (TRON)", key: "trc20Enabled" }].map(n => (
                <div key={n.key} className="flex items-center justify-between">
                  <span className="text-sm">{n.label}</span>
                  <Toggle k={n.key} />
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Security Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Require KYC Before Trading</span>
                <Toggle k="requireKycForTrading" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Require KYC Before Withdrawal</span>
                <Toggle k="requireKycForWithdrawal" />
              </div>
              {[
                { label: "Max Failed Login Attempts", key: "maxFailedLogins", type: "number" },
                { label: "Session Timeout (minutes)", key: "sessionTimeoutMinutes", type: "number" },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-52">{f.label}</label>
                  <input type={f.type} value={settings[f.key] ?? ""} onChange={e => update(f.key, e.target.value)}
                    className="w-28 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                </div>
              ))}
            </div>
          </div>

          {/* Deposit Addresses */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Platform Deposit Addresses</h3>
            <p className="text-xs text-muted-foreground mb-4">Users deposit USDT to these addresses. They verify their TX hash to get credited automatically.</p>
            <div className="space-y-4">
              {[
                { label: "BEP20 Address (BSC)", key: "bep20Address", placeholder: "0x..." },
                { label: "TRC20 Address (TRON)", key: "trc20Address", placeholder: "T..." },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input value={settings[f.key] ?? ""} onChange={e => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary placeholder:text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>

          {/* Change Admin Password */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Change Admin Password</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Update your admin panel login password. Must be at least 8 characters. The new password is stored in the database and overrides the environment variable.
            </p>
            <div className="space-y-3">
              {[
                { label: "Current Password", value: pwCurrent, setter: setPwCurrent, placeholder: "Your current password" },
                { label: "New Password", value: pwNew, setter: setPwNew, placeholder: "At least 8 characters" },
                { label: "Confirm New", value: pwConfirm, setter: setPwConfirm, placeholder: "Repeat new password" },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-muted-foreground flex-shrink-0 w-32">{f.label}</label>
                  <input
                    type="password"
                    value={f.value}
                    onChange={e => { f.setter(e.target.value); setPwStatus(null); }}
                    placeholder={f.placeholder}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  />
                </div>
              ))}
              {pwStatus && (
                <div className={`text-xs px-3 py-2 rounded-lg ${pwStatus.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {pwStatus.ok ? "✅ " : "❌ "}{pwStatus.msg}
                </div>
              )}
              <button
                onClick={changePassword}
                disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-40"
              >
                {pwSaving ? "Changing…" : "Change Password"}
              </button>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
