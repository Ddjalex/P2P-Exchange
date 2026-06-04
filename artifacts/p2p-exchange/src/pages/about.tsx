import { AppLayout } from "@/components/layout";
import { ArrowLeft, Shield, Zap, Users, Globe, Lock, TrendingUp } from "lucide-react";
import { Link } from "wouter";

const features = [
  { icon: Shield, title: "Secure Escrow", desc: "USDT is locked in escrow during every trade — released only after payment is confirmed." },
  { icon: Zap, title: "Fast Trades", desc: "Average trade completion under 2 minutes with our streamlined order flow." },
  { icon: Users, title: "Verified Traders", desc: "KYC-verified users earn a trust badge, enabling safer and larger trades." },
  { icon: Globe, title: "Local Payments", desc: "Supports CBE Birr, TeleBirr, Awash Bank, Dashen Bank, and more." },
  { icon: Lock, title: "Non-Custodial Feel", desc: "Deposit and withdraw to your own wallets at any time — your funds, your control." },
  { icon: TrendingUp, title: "Competitive Rates", desc: "Traders set their own rates — market competition keeps spreads tight." },
];

export default function AboutPage() {
  return (
    <AppLayout>
      <header className="p-4 border-b border-border bg-card flex items-center space-x-3">
        <Link href="/profile">
          <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-bold text-lg">About EthioP2P</h1>
      </header>

      <div className="p-4 space-y-6">
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <span className="text-2xl font-black text-primary">E</span>
          </div>
          <h2 className="text-2xl font-black mb-1">
            <span className="text-primary">Ethio</span>P2P
          </h2>
          <p className="text-sm text-muted-foreground">Ethiopia's Premier Crypto Exchange</p>
          <div className="inline-block mt-2 px-3 py-1 bg-primary/10 rounded-full text-xs text-primary font-medium">
            Version 1.0.0
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Our Mission</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            EthioP2P was built to give Ethiopians direct, secure access to the global crypto economy. We connect buyers and sellers of USDT through a trusted escrow platform — no middlemen, no hidden fees, just peer-to-peer trading powered by local payment methods.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Why EthioP2P?</h3>
          <div className="grid grid-cols-1 gap-3">
            {features.map(f => (
              <div key={f.title} className="bg-card border border-card-border rounded-xl p-4 flex items-start space-x-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
          {[
            ["Website", "www.ethiop2p.com"],
            ["Support", "support@ethiop2p.com"],
            ["Telegram", "@EthioP2P"],
            ["Terms of Service", "ethiop2p.com/terms"],
            ["Privacy Policy", "ethiop2p.com/privacy"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between p-4">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm text-primary">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          © 2024 EthioP2P. All rights reserved.{"\n"}Made with ❤️ for Ethiopia.
        </p>
      </div>
    </AppLayout>
  );
}
