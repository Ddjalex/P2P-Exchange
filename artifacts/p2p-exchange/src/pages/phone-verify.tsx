import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { ArrowLeft, Loader2, Phone, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY) ?? ""; }

export default function PhoneVerifyPage() {
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const isSmsVerified = !!(me as any)?.smsVerified;
  const currentPhone = (me as any)?.phone ?? "";
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [dialCode, setDialCode] = useState("+251");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const fullPhone = `${dialCode}${phone.replace(/^0+/, "")}`;

  if (isSmsVerified) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center space-x-3 p-4 border-b border-border bg-background sticky top-0">
          <button onClick={() => navigate("/profile")} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">SMS Verified</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold">Phone Already Verified</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Your phone number <span className="text-foreground font-medium">{currentPhone}</span> is already verified.
          </p>
          <button
            onClick={() => navigate("/profile")}
            className="w-full bg-primary text-background font-bold rounded-xl py-4 mt-2"
          >
            Back to Profile
          </button>
        </div>
      </AppLayout>
    );
  }

  const sendCode = async () => {
    const bare = phone.replace(/\D/g, "").replace(/^0+/, "");
    if (bare.length < 7) { setError("Enter a valid phone number"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ target: fullPhone, type: "phone" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("code");
      if (data.devCode) {
        setCode(data.devCode);
        toast({ title: "Dev mode: code auto-filled", description: `OTP: ${data.devCode}` });
      } else {
        toast({ title: `Verification code sent to ${fullPhone}` });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length < 4) { setError("Enter the verification code"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/profile/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ phone: fullPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      await refreshUser();
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center space-x-3 p-4 border-b border-border bg-background sticky top-0">
          <button onClick={() => navigate("/profile")} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">Phone Verified</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <h2 className="text-xl font-bold">Phone Added!</h2>
          <p className="text-muted-foreground text-sm">Your phone number has been verified. You can now receive SMS notifications.</p>
          <button
            onClick={() => navigate("/profile")}
            className="w-full bg-primary text-background font-bold rounded-xl py-4 mt-4"
          >
            Back to Profile
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border bg-background sticky top-0">
        <button
          onClick={() => step === "code" ? (setStep("phone"), setCode(""), setError("")) : navigate("/profile")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">Add Phone Number</h1>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center space-y-3 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {step === "phone"
              ? "Add your phone number to enable SMS notifications."
              : `Enter the 6-digit code sent to ${fullPhone}`}
          </p>
        </div>

        {step === "phone" ? (
          <div className="flex gap-2">
            <select
              value={dialCode}
              onChange={e => setDialCode(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-primary w-28"
            >
              <option value="+251">🇪🇹 +251</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+966">🇸🇦 +966</option>
            </select>
            <input
              type="tel"
              placeholder="974408281"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={e => e.key === "Enter" && sendCode()}
              autoFocus
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              inputMode="numeric"
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={e => e.key === "Enter" && verify()}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-center tracking-widest text-2xl font-mono focus:outline-none focus:border-primary"
            inputMode="numeric"
            autoFocus
          />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          onClick={step === "phone" ? sendCode : verify}
          disabled={loading}
          className="w-full bg-primary text-background rounded-xl py-4 text-sm font-bold disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Please wait...</span></>
            : <span>{step === "phone" ? "Send Verification Code" : "Verify & Save"}</span>}
        </button>

        {step === "code" && (
          <button
            onClick={() => { setStep("phone"); setCode(""); setError(""); }}
            className="w-full text-sm text-muted-foreground py-2"
          >
            ← Use different number
          </button>
        )}
      </div>
    </AppLayout>
  );
}
