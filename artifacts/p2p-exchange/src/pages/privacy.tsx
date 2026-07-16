import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

function ComplianceLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground sm:bg-black/90">
      <div className="min-h-screen bg-background sm:max-w-[480px] sm:mx-auto sm:border-x sm:border-border">
        <header className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center space-x-3">
          <Link href="/">
            <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-lg">{title}</h1>
        </header>
        <div className="p-4 pb-8 space-y-5 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-base text-foreground">{title}</h2>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <ComplianceLayout title="Privacy Policy">
      <p className="text-muted-foreground">
        <strong className="text-foreground">Effective date:</strong> 1 January 2026 &nbsp;|&nbsp;
        <strong className="text-foreground">Last updated:</strong> 12 July 2026
      </p>
      <p className="text-muted-foreground">
        Xendrx ("we", "us", "our") operates the xendrx.com platform and mobile application. This Privacy
        Policy explains what personal data we collect, why we collect it, and how we protect it. By using
        Xendrx you agree to the practices described here.
      </p>

      <Section title="1. Who We Are">
        <p>
          Xendrx is a peer-to-peer cryptocurrency exchange platform that lets users buy and sell USDT
          (Tether) using local currency and local payment methods. Our registered support email is{" "}
          <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a>.
        </p>
      </Section>

      <Section title="2. Data We Collect">
        <p><strong className="text-foreground">Account data:</strong> When you register, we collect your phone number or email address, and a hashed (never plain-text) password.</p>
        <p><strong className="text-foreground">KYC / identity data:</strong> To comply with anti-money-laundering obligations, verified users provide full legal name, date of birth, nationality, government-issued ID documents (national ID, passport or driving licence), and a selfie / liveness photograph.</p>
        <p><strong className="text-foreground">Transaction data:</strong> Records of every P2P order you place or fulfil, including amounts, payment method names, timestamps, and order status.</p>
        <p><strong className="text-foreground">Wallet data:</strong> Your on-chain USDT deposit addresses (derived from our HD wallet), withdrawal destination addresses you provide, and balance history.</p>
        <p><strong className="text-foreground">Communications:</strong> Messages you send through the in-app order chat are stored to enable dispute resolution.</p>
        <p><strong className="text-foreground">Device & technical data:</strong> IP address, browser / device type, and session tokens. We use this to detect fraud and secure accounts.</p>
        <p><strong className="text-foreground">Push notification tokens:</strong> If you opt in, we store your browser push subscription endpoint to send trade notifications.</p>
      </Section>

      <Section title="3. How We Use Your Data">
        <p>We use collected data to: (a) create and manage your account; (b) process P2P trades and escrow USDT; (c) verify your identity as required by applicable law; (d) detect and prevent fraud, money laundering and unauthorised access; (e) send trade alerts and platform announcements; (f) resolve disputes; (g) comply with legal obligations including record-keeping requirements.</p>
      </Section>

      <Section title="4. Legal Basis for Processing">
        <p>We process your data on the basis of: <strong className="text-foreground">contract performance</strong> (to deliver the service you signed up for); <strong className="text-foreground">legal obligation</strong> (KYC/AML requirements); and <strong className="text-foreground">legitimate interests</strong> (fraud prevention, platform security).</p>
      </Section>

      <Section title="5. Data Sharing">
        <p>We do not sell your personal data. We may share data with:</p>
        <p>• <strong className="text-foreground">KYC verification providers</strong> who process identity documents on our behalf under strict data-processing agreements.</p>
        <p>• <strong className="text-foreground">Cloud infrastructure providers</strong> (database hosting, object storage) bound by confidentiality obligations.</p>
        <p>• <strong className="text-foreground">Law enforcement or regulators</strong> when required by a valid legal order.</p>
        <p>• <strong className="text-foreground">Other platform users</strong> only to the extent necessary for a trade: your chosen payment method name (not your account number) is visible to your trade counterpart.</p>
      </Section>

      <Section title="6. KYC Document Retention">
        <p>Identity documents and selfies submitted for KYC are retained for a minimum of 5 years after account closure as required by applicable AML regulations. All KYC files are encrypted at rest.</p>
      </Section>

      <Section title="7. Cookies & Local Storage">
        <p>We store your authentication token in browser localStorage to keep you logged in. We do not use third-party advertising cookies. The Tawk.to live-chat widget may set its own functional cookies; you can disable these in your browser settings.</p>
      </Section>

      <Section title="8. Data Security">
        <p>All data in transit is encrypted using TLS 1.2+. Passwords are hashed using bcrypt. KYC files are encrypted at rest. We use Neon's hosted PostgreSQL with row-level access controls. No unencrypted personal data is stored in application logs.</p>
      </Section>

      <Section title="9. Your Rights">
        <p>Depending on your jurisdiction, you may have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion (subject to legal retention obligations); object to certain processing; and data portability. To exercise any right, email <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a> with the subject line "Privacy Request".</p>
      </Section>

      <Section title="10. International Transfers">
        <p>Your data may be stored and processed in data centres outside your country of residence. Where this occurs, we ensure adequate safeguards are in place (e.g. standard contractual clauses or equivalent protections).</p>
      </Section>

      <Section title="11. Children">
        <p>Xendrx is not intended for persons under 18 years of age. We do not knowingly collect data from minors. If you believe a minor has registered, contact us and we will delete the account.</p>
      </Section>

      <Section title="12. Changes to This Policy">
        <p>We may update this policy from time to time. Material changes will be notified via in-app notification at least 14 days before they take effect. Continued use of the platform after the effective date constitutes acceptance.</p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about this policy? Email us at <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a>.</p>
      </Section>

      <div className="pt-4 border-t border-border flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <Link href="/contact" className="text-primary hover:underline">Contact</Link>
        <Link href="/refund" className="text-primary hover:underline">Refund Policy</Link>
        <Link href="/about" className="text-primary hover:underline">About Xendrx</Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">© 2026 Xendrx. All rights reserved.</p>
    </ComplianceLayout>
  );
}
