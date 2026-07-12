import { Link } from "wouter";
import { ArrowLeft, Mail, Globe, MessageCircle, Send } from "lucide-react";

function ComplianceLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground sm:bg-black/90">
      <div className="min-h-screen bg-background sm:max-w-[480px] sm:mx-auto sm:border-x sm:border-border">
        <header className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center space-x-3">
          <Link href="/auth">
            <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <Mail className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-lg">{title}</h1>
        </header>
        <div className="p-4 pb-8 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <ComplianceLayout title="Contact Us">
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-3">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-1">Get in Touch</h2>
        <p className="text-sm text-muted-foreground">We're here to help. Reach us through any of the channels below.</p>
      </div>

      {/* Support email */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden divide-y divide-border text-sm">
        <a
          href="mailto:support@xendrx.com"
          className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">Email Support</div>
            <div className="text-primary text-xs">support@xendrx.com</div>
          </div>
        </a>

        <a
          href="https://t.me/Xendrx"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">Telegram</div>
            <div className="text-primary text-xs">@Xendrx</div>
          </div>
        </a>

        <a
          href="https://www.xendrx.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">Website</div>
            <div className="text-primary text-xs">www.xendrx.com</div>
          </div>
        </a>
      </div>

      {/* Business information */}
      <div className="bg-card border border-card-border rounded-xl p-4 space-y-3 text-sm">
        <h3 className="font-semibold">Business Information</h3>
        <div className="space-y-2 text-muted-foreground">
          <div>
            <span className="text-foreground font-medium">Company:</span>{" "}
            <span className="italic text-yellow-400/80">TODO: insert legal company name and registration number</span>
          </div>
          <div>
            <span className="text-foreground font-medium">Registered address:</span>{" "}
            <span className="italic text-yellow-400/80">TODO: insert business address</span>
          </div>
          <div>
            <span className="text-foreground font-medium">Phone:</span>{" "}
            <span className="italic text-yellow-400/80">TODO: insert phone number</span>
          </div>
          <div>
            <span className="text-foreground font-medium">Support email:</span>{" "}
            <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a>
          </div>
        </div>
      </div>

      {/* Response times */}
      <div className="bg-card border border-card-border rounded-xl p-4 space-y-2 text-sm">
        <h3 className="font-semibold">Response Times</h3>
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between"><span>Trade disputes</span><span className="text-foreground font-medium">Within 48 hours</span></div>
          <div className="flex justify-between"><span>General queries</span><span className="text-foreground font-medium">Within 24 hours</span></div>
          <div className="flex justify-between"><span>KYC review</span><span className="text-foreground font-medium">Within 48 hours</span></div>
          <div className="flex justify-between"><span>Withdrawal issues</span><span className="text-foreground font-medium">Within 2 hours</span></div>
        </div>
      </div>

      {/* Live chat note */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Live Chat:</strong> Once you're logged in, tap{" "}
        <strong className="text-foreground">Profile → Contact Support</strong> to open the live chat widget for immediate assistance.
      </div>

      <div className="pt-2 flex flex-wrap gap-3 text-xs">
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <Link href="/refund" className="text-primary hover:underline">Refund Policy</Link>
        <Link href="/about" className="text-primary hover:underline">About Xendrx</Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">© 2026 Xendrx. All rights reserved.</p>
    </ComplianceLayout>
  );
}
