import { Link } from "wouter";
import { ArrowLeft, RefreshCw } from "lucide-react";

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
          <RefreshCw className="w-5 h-5 text-primary" />
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

export default function RefundPage() {
  return (
    <ComplianceLayout title="Refund & Cancellation Policy">
      <p className="text-muted-foreground">
        <strong className="text-foreground">Effective date:</strong> 1 January 2026 &nbsp;|&nbsp;
        <strong className="text-foreground">Last updated:</strong> 12 July 2026
      </p>
      <p className="text-muted-foreground">
        This policy explains how cancellations, disputes, and refunds work on the Xendrx peer-to-peer
        exchange platform. Because Xendrx facilitates trades between independent users (not between
        users and Xendrx directly), the refund process follows the P2P escrow model described below.
      </p>

      {/* How escrow works */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
        <p className="font-semibold text-foreground mb-1">How Xendrx Escrow Works</p>
        <p className="text-muted-foreground">When a sell order is created, the seller's USDT is locked in Xendrx escrow. It is released to the buyer only after the seller manually confirms payment receipt. This protects both parties: buyers can't lose USDT to non-paying sellers, and sellers retain control until payment is verified.</p>
      </div>

      <Section title="1. Order Cancellation">
        <p><strong className="text-foreground">Before payment is marked:</strong> Either the buyer or the seller may cancel an order before the buyer marks payment as sent. The locked USDT is returned to the seller's available balance immediately with no fee charged.</p>
        <p><strong className="text-foreground">After payment is marked:</strong> Once the buyer has marked payment as sent, the order can no longer be cancelled by either party — it must proceed to completion or be resolved via the dispute process.</p>
        <p><strong className="text-foreground">Auto-cancellation:</strong> Orders that are not paid within the seller's stated payment time limit are cancelled automatically by the system. USDT is returned to the seller with no deduction.</p>
      </Section>

      <Section title="2. Dispute Resolution">
        <p>If there is a disagreement about whether payment was received, either party may open a dispute ("appeal") through the order screen.</p>
        <p><strong className="text-foreground">Evidence:</strong> Both parties should upload payment screenshots, bank statements, or any proof relevant to the dispute.</p>
        <p><strong className="text-foreground">Timeline:</strong> Xendrx support will review all submitted evidence and issue a binding decision within 48 hours of the appeal being raised.</p>
        <p><strong className="text-foreground">Possible outcomes:</strong></p>
        <p>• <strong className="text-foreground">Buyer wins:</strong> USDT is released from escrow to the buyer. The seller retains their fiat payment.</p>
        <p>• <strong className="text-foreground">Seller wins:</strong> USDT is returned from escrow to the seller's balance. The buyer is responsible for recovering their fiat payment from their payment provider.</p>
      </Section>

      <Section title="3. Refunds to Buyers">
        <p>If a dispute is resolved in the buyer's favour, the USDT is released to the buyer's Xendrx wallet immediately upon the admin's decision.</p>
        <p>Xendrx cannot refund fiat money (ETB, USD, etc.) that has been sent to a seller via bank transfer or mobile money — those are external payment systems outside our control. If you have made a fiat payment to a fraudulent seller, you should also report the payment to your bank or mobile money provider.</p>
      </Section>

      <Section title="4. Refunds to Sellers">
        <p>If a buyer fails to pay within the time limit, or if a dispute is resolved in the seller's favour, the locked USDT is returned to the seller's available balance in full.</p>
      </Section>

      <Section title="5. Platform Fee Refunds">
        <p>Trading fees (maker fee and taker fee) are charged only on successfully completed trades. No fees are charged on cancelled orders. Fees on completed trades are non-refundable — they cover the cost of escrow, dispute handling, and platform operation.</p>
      </Section>

      <Section title="6. Deposit Errors">
        <p>If you deposit USDT to your Xendrx wallet address but the funds do not appear after 30 minutes and at least 12 blockchain confirmations, contact us at <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a> with your transaction hash (TXID). We will investigate and credit your balance if the deposit is confirmed on-chain to your address.</p>
        <p>Xendrx cannot recover funds sent to incorrect addresses or on the wrong network. Always verify the deposit address and network (BEP20/BSC) before sending.</p>
      </Section>

      <Section title="7. Withdrawal Failures">
        <p>If a withdrawal you initiated fails to arrive at the destination address, contact support with your withdrawal ID within 7 days. We will investigate and either resend or refund the USDT to your Xendrx balance.</p>
      </Section>

      <Section title="8. Fraudulent or Reversed Payments">
        <p>Sellers who release USDT and subsequently find that the buyer's payment has been reversed (charge-back) by the buyer's bank or payment provider should immediately contact Xendrx support. We will investigate, and if the reversal is confirmed fraudulent, we will take action against the offending account. Xendrx does not guarantee recovery of funds lost to bank reversals, but we will cooperate with law enforcement investigations.</p>
      </Section>

      <Section title="9. How to Request Support">
        <p>For any refund or dispute-related query:</p>
        <p>1. Use the in-app dispute ("Appeal") button on the relevant order — this is the fastest route.</p>
        <p>2. Alternatively, email <a href="mailto:support@xendrx.com" className="text-primary">support@xendrx.com</a> with your order ID and a description of the issue.</p>
        <p>3. For urgent matters, use the live-chat widget (Profile → Contact Support when logged in).</p>
      </Section>

      <div className="pt-4 border-t border-border flex flex-wrap gap-3 text-xs">
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <Link href="/contact" className="text-primary hover:underline">Contact</Link>
        <Link href="/about" className="text-primary hover:underline">About Xendrx</Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">© 2026 Xendrx. All rights reserved.</p>
    </ComplianceLayout>
  );
}
