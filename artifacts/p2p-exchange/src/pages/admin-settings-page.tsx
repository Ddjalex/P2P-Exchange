import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet, adminPut, adminPost } from "@/lib/admin-api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFastsms, setShowFastsms] = useState(false);
  const [showBrevo, setShowBrevo] = useState(false);

  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [smsTestStatus, setSmsTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [emailTestStatus, setEmailTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [smsTestLoading, setSmsTestLoading] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);

  useEffect(() => {
    adminGet<Record<string, string>>("/settings").then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
              {[{ label: "TRC20 (TRON)", key: "trc20Enabled" }, { label: "ERC20 (Ethereum)", key: "erc20Enabled" }].map(n => (
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
            <h3 className="font-semibold mb-4">Platform Deposit Addresses</h3>
            <div className="space-y-4">
              {[
                { label: "TRC20 Address", key: "trc20Address" },
                { label: "ERC20 Address", key: "erc20Address" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input value={settings[f.key] ?? ""} onChange={e => update(f.key, e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary" />
                </div>
              ))}
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
