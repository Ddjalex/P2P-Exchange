import { Link } from "wouter";
import { ShieldCheck, Clock, ShieldX, AlertTriangle, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";

const GATE_CONFIG = {
  none: {
    icon: ShieldCheck,
    iconClass: "text-primary",
    bgClass: "bg-primary/10 border-primary/20",
    title: "Identity Verification Required",
    description: "Complete KYC verification to access your wallet, trade on the P2P market, post ads, and manage orders.",
    ctaLabel: "Start Verification",
    ctaHref: "/kyc",
    ctaClass: "bg-primary text-black",
    steps: [
      { label: "Personal Info", done: false },
      { label: "Document Upload", done: false },
      { label: "Liveness Check", done: false },
    ],
  },
  pending: {
    icon: Clock,
    iconClass: "text-warning",
    bgClass: "bg-warning/10 border-warning/20",
    title: "Verification Under Review",
    description: "Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days.",
    ctaLabel: "View Status",
    ctaHref: "/kyc",
    ctaClass: "bg-warning/20 text-warning border border-warning/40",
    steps: [
      { label: "Personal Info", done: true },
      { label: "Document Upload", done: true },
      { label: "Liveness Check", done: true },
    ],
  },
  rejected: {
    icon: ShieldX,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10 border-destructive/20",
    title: "Verification Rejected",
    description: "Your KYC submission was rejected. Please resubmit with clear, valid documents. Contact support if you need help.",
    ctaLabel: "Resubmit Documents",
    ctaHref: "/kyc",
    ctaClass: "bg-destructive text-white",
    steps: null,
  },
  more_info_required: {
    icon: AlertTriangle,
    iconClass: "text-orange-400",
    bgClass: "bg-orange-400/10 border-orange-400/20",
    title: "Additional Information Required",
    description: "Our team needs more information to complete your verification. Please update your submission.",
    ctaLabel: "Update Submission",
    ctaHref: "/kyc",
    ctaClass: "bg-orange-400 text-black",
    steps: null,
  },
} as const;

export function KycGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user || user.kycStatus === "verified") {
    return <>{children}</>;
  }

  const status = user.kycStatus as keyof typeof GATE_CONFIG;
  const cfg = GATE_CONFIG[status] ?? GATE_CONFIG.none;
  const Icon = cfg.icon;

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-5 py-10">
        <div className={`w-full max-w-sm border rounded-2xl p-6 space-y-5 ${cfg.bgClass}`}>
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-background/60 flex items-center justify-center">
              <Icon className={`w-8 h-8 ${cfg.iconClass}`} />
            </div>
          </div>

          {/* Title + description */}
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">{cfg.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{cfg.description}</p>
          </div>

          {/* Progress steps (none / pending only) */}
          {cfg.steps && (
            <div className="space-y-2">
              {cfg.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                    ${step.done ? "bg-primary text-black" : "bg-border text-muted-foreground"}`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <Link href={cfg.ctaHref}>
            <button className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 ${cfg.ctaClass}`}>
              {cfg.ctaLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>

          {/* Help link */}
          <p className="text-center text-xs text-muted-foreground/70">
            Questions?{" "}
            <Link href="/help-center" className="text-primary hover:underline">
              Visit Help Center
            </Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
