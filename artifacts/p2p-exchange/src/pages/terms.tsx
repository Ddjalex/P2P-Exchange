import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

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
          <FileText className="w-5 h-5 text-primary" />
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

export default function TermsPage() {
  return (
    <ComplianceLayout title="Terms & Conditions">
      <p className="text-muted-foreground">
        <strong className="text-foreground">Effective date:</strong> 1 January 2026 &nbsp;|&nbsp;
        <strong className="text-foreground">Last updated:</strong> 12 July 2026
      </p>
      <p className="text-muted-foreground">
        Please read these Terms and Conditions ("Terms") carefully before using the Xendrx platform
        at xendrx.com ("Platform"). By creating an account or using the Platform, you confirm that
        you have read, understood, and agree to be bound by these Terms.
      </p>

      <Section title="1. About Xendrx">
        <p>Xendrx is a peer-to-peer (P2P) marketplace that enables users to buy and sell USDT (Tether, a USD-pegged stablecoin) directly with each other using local fiat currencies and local payment methods. Xendrx acts as an escrow intermediary only; it is not a buyer, seller, broker, or financial adviser.</p>
      </Section>

      <Section title="2. Eligibility">
        <p>You must be at least 18 years old and legally permitted to use cryptocurrency services in your jurisdiction. By registering, you represent that: (a) you are of legal age; (b) you are not on any sanctions list; (c) your use of the Platform complies with all applicable laws in your country of residence.</p>
      </Section>

      <Section title="3. Account Registration & Security">
        <p>You are responsible for maintaining the confidentiality of your login credentials. You must not share your password or OTP with anyone, including Xendrx support staff. We will never ask for your password. Notify us immediately at <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a> if you suspect unauthorised access to your account.</p>
      </Section>

      <Section title="4. KYC Verification">
        <p>Identity verification (KYC) is required to trade on the Platform. Providing false or misleading information during KYC is grounds for immediate account suspension and may be reported to relevant authorities. Verified status may be revoked if we suspect document fraud.</p>
      </Section>

      <Section title="5. P2P Trading Rules">
        <p><strong className="text-foreground">5.1 Escrow:</strong> When a sell order is created, the seller's USDT is locked in our escrow. USDT is released to the buyer only after the seller confirms receipt of payment. Never release escrow before confirming payment in your own bank/wallet account.</p>
        <p><strong className="text-foreground">5.2 Payment obligation:</strong> Buyers must complete payment within the time limit specified in the trade. Failure to pay will result in automatic order cancellation.</p>
        <p><strong className="text-foreground">5.3 Prohibited conduct:</strong> You must not: attempt to reverse payments after USDT has been released; use stolen payment methods; post false or misleading ads; collude with other users to manipulate prices; or use the Platform for money laundering.</p>
        <p><strong className="text-foreground">5.4 Price setting:</strong> Sellers set their own exchange rates. Xendrx does not guarantee any particular rate. Rates may differ from market rates.</p>
      </Section>

      <Section title="6. Fees">
        <p>Xendrx charges a maker fee and a taker fee on completed trades. Current fee rates are displayed in the ad creation flow and on the order confirmation screen. Fees are deducted from the USDT amount before release. Fees are non-refundable once a trade is completed.</p>
      </Section>

      <Section title="7. Deposits & Withdrawals">
        <p>USDT deposits are credited after sufficient blockchain confirmations. Withdrawal requests are processed within 30 minutes during normal operation. Xendrx is not responsible for delays caused by network congestion. Withdrawals to addresses that do not support USDT (BEP20) may result in permanent loss of funds — always verify the correct network before withdrawing.</p>
      </Section>

      <Section title="8. Disputes">
        <p>Either party may raise a dispute ("appeal") on an unpaid or contested order. Our support team will review evidence (chat messages, payment screenshots) and make a binding decision within 48 hours. Both parties agree to abide by Xendrx's dispute resolution decisions. Xendrx's decision is final for in-platform disputes.</p>
      </Section>

      <Section title="9. Prohibited Use">
        <p>The Platform must not be used for: illegal goods or services; money laundering or terrorist financing; circumventing sanctions; market manipulation; fraud, phishing, or impersonation; any activity that violates applicable law.</p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>To the maximum extent permitted by law, Xendrx shall not be liable for: (a) losses arising from user error (e.g. withdrawing to the wrong address); (b) losses due to price volatility; (c) losses caused by third-party payment processor delays or failures; (d) indirect, incidental, or consequential damages. Our aggregate liability shall not exceed the fees you paid to us in the 30 days preceding the claim.</p>
      </Section>

      <Section title="11. Platform Availability">
        <p>We aim for 24/7 availability but do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance where possible. We are not liable for losses caused by downtime.</p>
      </Section>

      <Section title="12. Intellectual Property">
        <p>All content, branding, and software on the Platform are owned by or licensed to Xendrx. You may not copy, reverse-engineer, or redistribute any part of the Platform without written permission.</p>
      </Section>

      <Section title="13. Account Termination">
        <p>We may suspend or terminate your account if you breach these Terms, are found to be engaging in prohibited activities, or are required to do so by law. Upon termination, any USDT balance not subject to a freeze will be made available for withdrawal after a review period.</p>
      </Section>

      <Section title="14. Governing Law">
        <p>These Terms are governed by the laws of the jurisdiction in which Xendrx is registered. Disputes not resolved through our internal process may be referred to the competent courts of that jurisdiction.</p>
      </Section>

      <Section title="15. Changes to Terms">
        <p>We may update these Terms from time to time. You will be notified of material changes via in-app notification at least 14 days in advance. Continued use after the effective date constitutes acceptance.</p>
      </Section>

      <Section title="16. Contact">
        <p>For questions about these Terms, contact <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a>.</p>
      </Section>

      <div className="pt-4 border-t border-border flex flex-wrap gap-3 text-xs">
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link href="/contact" className="text-primary hover:underline">Contact</Link>
        <Link href="/refund" className="text-primary hover:underline">Refund Policy</Link>
        <Link href="/about" className="text-primary hover:underline">About Xendrx</Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">© 2026 Xendrx. All rights reserved.</p>
    </ComplianceLayout>
  );
}
