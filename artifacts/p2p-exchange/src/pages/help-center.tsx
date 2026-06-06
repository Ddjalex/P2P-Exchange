import { AppLayout } from "@/components/layout";
import { ArrowLeft, ChevronDown, ChevronUp, Search, MessageCircle, Book, Shield, Wallet, ArrowRightLeft } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const faqs = [
  {
    category: "Getting Started",
    icon: Book,
    items: [
      {
        q: "What is Xendrx?",
        a: "Xendrx is a peer-to-peer cryptocurrency exchange platform. It lets you buy and sell USDT (Tether) directly with other users using local currency through bank transfers, mobile money, and other local payment methods.",
      },
      {
        q: "How do I complete my profile?",
        a: "Go to Profile → verify your email/phone, complete KYC (identity verification), and add your payment methods. A complete profile builds trust with other traders.",
      },
      {
        q: "What is KYC verification?",
        a: "KYC (Know Your Customer) is a 3-step identity verification: personal info, document upload (national ID/passport), and a selfie check. Verified users can trade larger amounts and earn a Verified badge.",
      },
    ],
  },
  {
    category: "Trading",
    icon: ArrowRightLeft,
    items: [
      {
        q: "How do I buy USDT?",
        a: "Go to P2P → select Buy → browse available sell ads → pick one that matches your amount and payment method → click Buy → transfer funds to the seller using their listed payment method → mark payment as sent → wait for the seller to release your USDT.",
      },
      {
        q: "How do I sell USDT?",
        a: "Go to Ads → Post Ad → select Sell → set your price, min/max amount, and accepted payment methods → go online. When a buyer places an order, they'll send you funds and you release USDT from escrow.",
      },
      {
        q: "What happens to my USDT during a trade?",
        a: "When a sell order is created, the USDT is locked in escrow (frozen balance) automatically. It's released to the buyer only after you confirm receipt of payment.",
      },
      {
        q: "What if a trade goes wrong?",
        a: "If there's a dispute, either party can appeal the order. Our support team will review evidence and resolve it within 24 hours. Never release USDT before confirming payment receipt.",
      },
    ],
  },
  {
    category: "Wallet & Payments",
    icon: Wallet,
    items: [
      {
        q: "How do I deposit USDT?",
        a: "Go to Wallet → tap Deposit → copy your TRC20 or ERC20 wallet address → send USDT from your external wallet. Deposits are credited after blockchain confirmation.",
      },
      {
        q: "How do I withdraw USDT?",
        a: "Go to Wallet → tap Withdraw → enter the destination wallet address and amount. Withdrawals are processed within 30 minutes. A small network fee applies.",
      },
      {
        q: "What payment methods are supported?",
        a: "Supported methods include bank transfers, mobile money, and other local payment options. Payment methods are set per-ad by each trader.",
      },
    ],
  },
  {
    category: "Security",
    icon: Shield,
    items: [
      {
        q: "How is my account secured?",
        a: "Your account uses JWT authentication, OTP verification for login, and your funds are protected by escrow during trades. Always use a strong password and never share your credentials.",
      },
      {
        q: "What should I do if I suspect fraud?",
        a: "Never release USDT before confirming funds are in your account. If you suspect fraud, do not cancel the order — instead, use the Appeal option to open a dispute with our support team.",
      },
      {
        q: "Can I block someone?",
        a: "Yes. Go to Profile → Trade → Blocked Users. You can also block users directly from a trade. Blocked users cannot place orders on your ads.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-sm font-medium pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      search === "" ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <AppLayout>
      <header className="p-4 border-b border-border bg-card flex items-center space-x-3">
        <Link href="/profile">
          <button className="p-1 rounded-lg hover:bg-secondary/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-bold text-lg">Help Center</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for help..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start space-x-3">
          <MessageCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-primary">Need more help?</div>
            <div className="text-xs text-muted-foreground mt-0.5">Contact us via the chat feature on any active order, or email us at support@xendrx.com</div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No results for "{search}"</p>
          </div>
        ) : (
          filtered.map(cat => (
            <div key={cat.category} className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="flex items-center space-x-2 p-4 border-b border-border bg-secondary/30">
                <cat.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{cat.category}</span>
              </div>
              {cat.items.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
