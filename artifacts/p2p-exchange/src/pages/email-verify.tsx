import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY) ?? ""; }

export default function EmailVerifyPage() {
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const isEmailVerified = !!(me as any)?.emailVerified;
  const currentEmail = (me as any)?.email ?? "";
  const isPhoneEmail = currentEmail.endsWith("@phone.xendrx.com");
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (isEmailVerified && !isPhoneEmail) {
    return (
      <AppLayout showNav={false}>
        <header className="flex items-center space-x-3 p-4 border-b border-border bg-background sticky top-0">
          <button onClick={() => navigate("/profile")} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">Email Verified</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold">Email Already Verified</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Your email address <span className="text-foreground font-medium">{currentEmail}</span> is already verified.
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

  const verify = async () => {
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
          <h1 className="font-bold">Email Verified</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <h2 className="text-xl font-bold">Email Added!</h2>
          <p className="text-muted-foreground text-sm">Your email has been verified successfully. You can now receive email notifications.</p>
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
          onClick={() => step === "code" ? (setStep("email"), setCode(""), setError("")) : navigate("/profile")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">Add Email Address</h1>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center space-y-3 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {step === "email"
              ? "Add your email address to enable email notifications."
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendCode()}
            autoFocus
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
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
          onClick={step === "email" ? sendCode : verify}
          disabled={loading}
          className="w-full bg-primary text-background rounded-xl py-4 text-sm font-bold disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Please wait...</span></>
            : <span>{step === "email" ? "Send Verification Code" : "Verify & Save"}</span>}
        </button>

        {step === "code" && (
          <button
            onClick={() => { setStep("email"); setCode(""); setError(""); }}
            className="w-full text-sm text-muted-foreground py-2"
          >
            ← Use different email
          </button>
        )}
      </div>
    </AppLayout>
  );
}
