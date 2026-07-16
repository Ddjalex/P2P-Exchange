import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "./landing.css";

// ── Static data ────────────────────────────────────────────────────────────
const MARKET_BUYS = [
  { init: 'AK', name: 'Alex K.',     orders: 312, rate: '1.052', limits: '50 – 500',    method: 'Wise' },
  { init: 'SM', name: 'Sara M.',     orders: 204, rate: '1.048', limits: '100 – 1,000', method: 'Revolut' },
  { init: 'JD', name: 'James D.',    orders: 478, rate: '1.055', limits: '20 – 200',    method: 'PayPal' },
  { init: 'LN', name: 'Lena N.',     orders: 139, rate: '1.044', limits: '500 – 2,000', method: 'Bank Transfer' },
  { init: 'MO', name: 'Mark O.',     orders: 561, rate: '1.060', limits: '10 – 100',    method: 'M-Pesa' },
];
const MARKET_SELLS = [
  { init: 'FH', name: 'Fatima H.',  orders: 287, rate: '1.038', limits: '50 – 500',    method: 'Wise' },
  { init: 'RC', name: 'Ryan C.',    orders: 411, rate: '1.035', limits: '200 – 2,000', method: 'PayPal' },
  { init: 'YB', name: 'Yuki B.',    orders: 193, rate: '1.041', limits: '100 – 800',   method: 'Bank Transfer' },
  { init: 'PW', name: 'Priya W.',   orders: 356, rate: '1.032', limits: '20 – 250',    method: 'Revolut' },
  { init: 'TG', name: 'Tom G.',     orders: 628, rate: '1.045', limits: '500 – 5,000', method: 'MTN Money' },
];
const PAYMENT_METHODS = [
  // ── Global wallets & transfers
  { name: 'Bank Transfer',        icon: '🏦', tag: 'Universal' },
  { name: 'Wise',                 icon: '💳', tag: 'Universal' },
  { name: 'PayPal',               icon: '🔵', tag: 'Universal' },
  { name: 'Revolut',              icon: '🔄', tag: 'Universal' },
  { name: 'Skrill',               icon: '💜', tag: 'Universal' },
  { name: 'Neteller',             icon: '🌐', tag: 'Universal' },
  { name: 'Western Union',        icon: '🟡', tag: 'Universal' },
  { name: 'MoneyGram',            icon: '🟠', tag: 'Universal' },
  { name: 'SEPA Transfer',        icon: '🇪🇺', tag: 'Europe' },
  { name: 'SWIFT Wire',           icon: '🏛️', tag: 'Universal' },
  { name: 'USDT (BEP20)',         icon: '🔷', tag: 'Crypto' },
  { name: 'USDT (TRC20)',         icon: '🔹', tag: 'Crypto' },
  // ── Americas
  { name: 'Cash App',             icon: '💵', tag: 'USA' },
  { name: 'Zelle',                icon: '⚡', tag: 'USA' },
  { name: 'Venmo',                icon: '🔵', tag: 'USA' },
  { name: 'Chime',                icon: '💚', tag: 'USA' },
  { name: 'Interac e-Transfer',   icon: '🍁', tag: 'Canada' },
  // ── Europe
  { name: 'BLIK',                 icon: '🇵🇱', tag: 'Europe' },
  { name: 'Bizum',                icon: '🇪🇸', tag: 'Europe' },
  { name: 'Satispay',             icon: '🇮🇹', tag: 'Europe' },
  { name: 'Paysera',              icon: '🟢', tag: 'Europe' },
  { name: 'Klarna',               icon: '🩷', tag: 'Europe' },
  // ── Africa mobile money
  { name: 'M-Pesa',               icon: '📱', tag: 'Africa' },
  { name: 'MTN Mobile Money',     icon: '🟡', tag: 'Africa' },
  { name: 'Airtel Money',         icon: '🔴', tag: 'Africa' },
  { name: 'Orange Money',         icon: '🟠', tag: 'Africa' },
  { name: 'Wave',                 icon: '🌊', tag: 'Africa' },
  { name: 'OPay',                 icon: '🟢', tag: 'Africa' },
  { name: 'Flutterwave',          icon: '🦋', tag: 'Africa' },
  { name: 'Chipper Cash',         icon: '🐿️', tag: 'Africa' },
  { name: 'Moov Money',           icon: '➡️', tag: 'Africa' },
  { name: 'Coris Money',          icon: '🏧', tag: 'Africa' },
  { name: 'Telebirr',             icon: '📶', tag: 'Africa' },
  { name: 'CBEBirr',              icon: '🏦', tag: 'Africa' },
  { name: 'Zaad Service',         icon: '📡', tag: 'Africa' },
  // ── Asia & Middle East
  { name: 'bKash',                icon: '🟠', tag: 'Bangladesh' },
  { name: 'Nagad',                icon: '🔵', tag: 'Bangladesh' },
  { name: 'JazzCash',             icon: '🎵', tag: 'Pakistan' },
  { name: 'Easypaisa',            icon: '✅', tag: 'Pakistan' },
  { name: 'Paytm',                icon: '🇮🇳', tag: 'India' },
  { name: 'GCash',                icon: '🇵🇭', tag: 'Philippines' },
  { name: 'GoPay',                icon: '🇮🇩', tag: 'Indonesia' },
  { name: 'Alipay',               icon: '🔷', tag: 'China' },
  { name: 'WeChat Pay',           icon: '💬', tag: 'China' },
  { name: 'KakaoPay',             icon: '🟡', tag: 'Korea' },
  { name: 'ZainCash',             icon: '🟢', tag: 'Middle East' },
  { name: 'ZaloPay',              icon: '🔵', tag: 'Vietnam' },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [loaded, setLoaded]           = useState(false);
  const [showLoader, setShowLoader]   = useState(true);
  const [loaderDone, setLoaderDone]   = useState(false);
  const [loaderPct, setLoaderPct]     = useState(0);
  const [mousePos, setMousePos]       = useState({ x: 0.5, y: 0.5 });
  const [slideIndex, setSlideIndex]   = useState(0);
  const [scrollY, setScrollY]         = useState(0);
  const [scrollPct, setScrollPct]     = useState(0);
  const [marketTab, setMarketTab]     = useState<'buy' | 'sell'>('buy');
  const heroRef = useRef<HTMLElement>(null);

  const slides = [
    '/slide1.webp',
    '/slide2.webp',
    '/slide3.webp',
    '/slide4.webp',
    '/slide5.webp',
  ];

  // ── Cinematic loader — counts 0→100 then splits the curtain ──────────
  useEffect(() => {
    const DURATION = 1700; // ms for 0→100
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / DURATION, 1);
      // ease-out-expo: fast start, decelerates near 100
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setLoaderPct(Math.floor(eased * 100));

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Hold at 100% briefly, then open curtain
        setTimeout(() => {
          setLoaderDone(true);          // triggers CSS curtain-split
          setTimeout(() => {
            setShowLoader(false);       // unmount overlay
            setLoaded(true);            // start hero entrance anims
          }, 750);
        }, 280);
      }
    }
    requestAnimationFrame(tick);
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    const t = setInterval(() => setSlideIndex(i => (i + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Mouse-tracking glow
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (e.clientY > rect.bottom) return;
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    }
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);

  // Scroll tracking — progress bar + parallax
  useEffect(() => {
    function onScroll() {
      const sy = window.scrollY;
      setScrollY(sy);
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setScrollPct(max > 0 ? (sy / max) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── True bidirectional scroll-reveal ─────────────────────────────────
  // Adds lp-visible when element enters viewport from ANY direction.
  // Removes lp-visible when element leaves viewport in ANY direction,
  // so the animation replays both on scroll-down AND scroll-up.
  useEffect(() => {
    if (!loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-visible");
          } else {
            // Exit in either direction → reset so it re-animates on re-entry
            entry.target.classList.remove("lp-visible");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -4% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded]);

  const glowX = mousePos.x * 100;
  const glowY = 55 + mousePos.y * 20;

  // Hero parallax — text drifts up at 25 % of scroll speed
  const heroParallax = Math.min(scrollY * 0.28, 200);

  // Utility: typed inline style helper for CSS custom properties
  const delay = (s: number) => ({ "--delay": `${s}s` } as React.CSSProperties);

  // Decimal percentage display matching the reference video style
  const pctInt  = loaderPct;
  const pctFrac = ((loaderPct * 100) % 100).toString().padStart(2, "0");

  return (
    <>
      {/* ── CINEMATIC LOADER OVERLAY — sibling of lp-root so parent opacity:0 can't hide it ── */}
      {showLoader && (
        <div className={`lp-loader${loaderDone ? " lp-loader-done" : ""}`} aria-hidden="true">
          {/* Split-curtain panels — slide away when done */}
          <div className="lp-loader-panel lp-loader-panel-top" />
          <div className="lp-loader-panel lp-loader-panel-bot" />

          {/* Centred content — fades out as curtain splits */}
          <div className="lp-loader-body">
            <div className="lp-loader-logo">
              <span className="lp-loader-diamond">◆</span>
              <span className="lp-loader-wordmark">
                xen<span className="lp-loader-accent">drx</span>
              </span>
            </div>

            <div className="lp-loader-track">
              <div className="lp-loader-fill" style={{ width: `${loaderPct}%` }} />
              <div className="lp-loader-glow-dot" style={{ left: `${loaderPct}%` }} />
            </div>

            <div className="lp-loader-pct">
              {pctInt.toString().padStart(2, "0")}.{pctFrac}
              <span className="lp-loader-pct-sign">%</span>
            </div>
          </div>
        </div>
      )}

    <div className={`lp-root${loaded ? " lp-loaded" : ""}`}>

      {/* ── Scroll progress bar ── */}
      <div className="lp-progress" style={{ width: `${scrollPct}%` }} />

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-logo">
          <span className="lp-logo-mark">◆</span>
          <span className="lp-logo-text">xen<span className="lp-cyan">drx</span></span>
        </div>
        <div className="lp-nav-links">
          <a href="#how">How It Works</a>
          <a href="#security">Security</a>
        </div>
        <div className="lp-nav-auth">
          <button className="lp-nav-signin" onClick={() => setLocation("/auth")}>Log In</button>
          <button className="lp-nav-cta" onClick={() => setLocation("/auth?tab=register")}>Sign Up</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero" ref={heroRef}>

        {/* Full-bleed background slideshow */}
        <div className="lp-slideshow">
          {slides.map((src, i) => (
            <img
              key={src}
              src={src}
              className={`lp-slide${i === slideIndex ? ' lp-slide-active' : ''}`}
              alt={`Xendrx ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ))}
        </div>

        <div className="lp-hero-overlay" />

        <div
          className="lp-hero-glow"
          style={{
            background: `radial-gradient(ellipse 60% 50% at ${glowX}% ${glowY}%, rgba(0,229,255,0.10) 0%, transparent 70%)`,
          }}
        />

        {/* Parallax text wrapper — drifts up as user scrolls */}
        <div className="lp-hero-parallax" style={{ transform: `translateY(${heroParallax}px)` }}>
          <div className="lp-hero-label">P2P Crypto Exchange · Global</div>
          <h1 className="lp-hero-headline">
            <span className="lp-hero-line1">TRADING</span>
            <span className="lp-hero-line2">USDT.</span>
          </h1>
          <p className="lp-hero-sub">
            Buy and sell USDT directly peer-to-peer —<br className="lp-br-desktop" />
            no banks, no borders, no limits.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary" onClick={() => setLocation("/auth")}>Start Trading</button>
            <a href="#how" className="lp-btn-ghost">How it works ↓</a>
          </div>

        </div>

        {/* Desktop slide dots */}
        <div className="lp-slide-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`lp-slide-dot${i === slideIndex ? ' lp-slide-dot-active' : ''}`}
              onClick={() => setSlideIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Mobile: contained image card */}
        <div className="lp-hero-mobile-preview">
          {slides.map((src, i) => (
            <img
              key={src}
              src={src}
              className={`lp-mobile-slide${i === slideIndex ? ' lp-mobile-slide-active' : ''}`}
              alt={`Xendrx ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ))}
          <div className="lp-mobile-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`lp-slide-dot${i === slideIndex ? ' lp-slide-dot-active' : ''}`}
                onClick={() => setSlideIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

      </section>

      {/* ── BENEFITS TICKER ── */}
      <div className="lp-ticker" aria-hidden="true">
        <div className="lp-ticker-track">
          {[
            '⚡ Instant Settlement',
            '🔒 Escrow Protected',
            '0% Platform Fee',
            '🌍 119 Countries',
            '💳 1,300+ Payment Methods',
            '✅ KYC Verified Traders',
            '📱 24/7 Support',
            '🔐 BEP-20 Native',
            '⚡ Instant Settlement',
            '🔒 Escrow Protected',
            '0% Platform Fee',
            '🌍 119 Countries',
            '💳 1,300+ Payment Methods',
            '✅ KYC Verified Traders',
            '📱 24/7 Support',
            '🔐 BEP-20 Native',
          ].map((item, i) => (
            <span key={i} className="lp-ticker-item">{item}</span>
          ))}
        </div>
      </div>

      {/* ── CARD SECTION ── */}
      <section className="lp-card-section" id="card">
        <div className="lp-card-section-inner">

          {/* Card visual — slides in from left */}
          <div className="lp-card-visual" data-reveal="left">
            <div className="lp-card-orbit" />
            <div className="lp-card-orbit lp-card-orbit-2" />
            <div className="lp-card-glow-base" />
            <img src="/slide4.webp" alt="Xendrx Card" className="lp-card-img" loading="lazy" decoding="async" />
          </div>

          {/* Content — staggered from right */}
          <div className="lp-card-content">
            <div className="lp-card-eyebrow" data-reveal="right" style={delay(0)}>◈ &nbsp;Card System</div>
            <h2 className="lp-card-title" data-reveal="right" style={delay(0.12)}>
              Pay anywhere.<br /><span className="lp-cyan">Instantly.</span>
            </h2>
            <p className="lp-card-desc" data-reveal="blur" style={delay(0.22)}>
              Your USDT balance, spendable everywhere. Get a virtual Xendrx Visa card
              in seconds — accepted at 50 million+ merchants in 119 countries. No bank required.
            </p>
            <div className="lp-card-features">
              {[
                { icon: '⚡', label: 'Instant Setup',  sub: 'Virtual card live in under a minute' },
                { icon: '🌍', label: 'Global Reach',   sub: '119 countries · 50M+ merchants'      },
                { icon: '◈',  label: 'Crypto-Backed',  sub: 'Spend your USDT balance directly'     },
                { icon: '◻',  label: 'Visa Network',   sub: 'Accepted everywhere Visa works'       },
              ].map((f, i) => (
                <div className="lp-card-feature" key={f.label} data-reveal="up" style={delay(0.32 + i * 0.08)}>
                  <div className="lp-card-feature-icon">{f.icon}</div>
                  <div>
                    <div className="lp-card-feature-label">{f.label}</div>
                    <div className="lp-card-feature-sub">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="lp-btn-card-cta" data-reveal="up" style={delay(0.55)} onClick={() => setLocation('/auth')}>
              Create Your Card &nbsp;→
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 01 — HOW IT WORKS ── */}
      <section className="lp-section" id="how">
        <div className="lp-section-number" data-reveal="left" style={delay(0)}>01</div>
        <div className="lp-section-content">
          <h2 className="lp-section-title" data-reveal="up" style={delay(0.1)}>How It Works</h2>
          <p className="lp-section-desc" data-reveal="blur" style={delay(0.2)}>
            Peer-to-peer trading means you trade directly with other users — no
            intermediaries, no bank delays. We hold the USDT in escrow and
            release it the moment payment is confirmed.
          </p>
          <div className="lp-steps">
            <div className="lp-step" data-reveal="up" style={delay(0.1)}>
              <div className="lp-step-icon">01</div>
              <h3>Post an Ad</h3>
              <p>List your buy or sell offer with your price, preferred payment methods, and trade limits.</p>
            </div>
            <div className="lp-step-arrow" data-reveal="scale" style={delay(0.28)}>→</div>
            <div className="lp-step" data-reveal="up" style={delay(0.26)}>
              <div className="lp-step-icon">02</div>
              <h3>Match & Chat</h3>
              <p>Browse live orders, pick your counterparty, and confirm details via encrypted in-app chat.</p>
            </div>
            <div className="lp-step-arrow" data-reveal="scale" style={delay(0.46)}>→</div>
            <div className="lp-step" data-reveal="up" style={delay(0.42)}>
              <div className="lp-step-icon">03</div>
              <h3>Release & Done</h3>
              <p>USDT is locked in escrow. Once payment lands, funds are released to the buyer instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 02 — SECURITY ── */}
      <section className="lp-section" id="security">
        <div className="lp-section-number" data-reveal="left" style={delay(0)}>02</div>
        <div className="lp-section-content">
          <h2 className="lp-section-title" data-reveal="up" style={delay(0.1)}>Secure by Design</h2>
          <p className="lp-section-desc" data-reveal="blur" style={delay(0.2)}>
            Every trade is protected by on-chain escrow. Every trader is
            identity-verified. No single point of custody — ever.
          </p>
          <div className="lp-features">
            {[
              { icon: '⬡', title: 'Escrow Protection', body: 'USDT is locked on-chain until both parties confirm. No counterparty trust required.' },
              { icon: '⊛', title: 'KYC Verified',       body: 'Every trader completes identity verification before their first trade — zero anonymous actors.' },
              { icon: '◈', title: 'BEP-20 Native',      body: 'USDT on Binance Smart Chain — fast settlement, minimal fees, and battle-tested infrastructure.' },
              { icon: '⟁', title: 'Dispute Resolution', body: 'Admin-mediated disputes protect both sides in every edge case — no trade left unresolved.' },
            ].map((f, i) => (
              <div className="lp-feature" key={f.title} data-reveal="scale" style={delay(0.1 + i * 0.1)}>
                <div className="lp-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAYMENT METHODS ── */}
      <section className="lp-pm-section">
        <div className="lp-pm-inner">
          <div className="lp-pm-header">
            <div className="lp-market-eyebrow" data-reveal="down" style={delay(0)}>◆ &nbsp;Payment Methods</div>
            <h2 className="lp-pm-title" data-reveal="up" style={delay(0.1)}>
              Pay Your Way
            </h2>
            <p className="lp-pm-subtitle" data-reveal="blur" style={delay(0.18)}>
              1,300+ payment methods across 160+ countries — bank transfers, mobile wallets, crypto, and more.
            </p>
          </div>
          <div className="lp-pm-grid" data-reveal="up" style={delay(0.25)}>
            {PAYMENT_METHODS.map((m) => (
              <div className="lp-pm-chip" key={m.name}>
                <span className="lp-pm-icon">{m.icon}</span>
                <span className="lp-pm-chip-body">
                  <span className="lp-pm-name">{m.name}</span>
                  <span className="lp-pm-tag">{m.tag}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-glow" />
        <div className="lp-cta-label"   data-reveal="down"  style={delay(0)}>Get Started Today</div>
        <h2 className="lp-cta-headline" data-reveal="up"    style={delay(0.12)}>
          Start Trading<br />in Minutes.
        </h2>
        <p className="lp-cta-sub"       data-reveal="blur"  style={delay(0.24)}>
          Create your account, complete KYC, and make your first trade — all within the day.
        </p>
        <div className="lp-cta-actions" data-reveal="up"    style={delay(0.36)}>
          <button className="lp-btn-primary lp-btn-large" onClick={() => setLocation("/auth")}>Create Account</button>
          <button className="lp-btn-outline"              onClick={() => setLocation("/auth")}>Sign In</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <span className="lp-logo-mark">◆</span>
              <span className="lp-logo-text">xen<span className="lp-cyan">drx</span></span>
            </div>
            <p>Peer-to-peer USDT trading — fast,<br />secure, and borderless.</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <div className="lp-footer-col-label">Platform</div>
              <a href="#how">How It Works</a>
              <a href="#security">Security</a>
              <a onClick={() => setLocation("/auth")}>Sign In</a>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-label">Legal</div>
              <a onClick={() => setLocation("/terms")}>Terms of Service</a>
              <a onClick={() => setLocation("/privacy")}>Privacy Policy</a>
              <a onClick={() => setLocation("/refund")}>Refund Policy</a>
              <a onClick={() => setLocation("/contact")}>Contact</a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Xendrx. All rights reserved.</span>
          <span>SWAP · TRADE · GROW</span>
        </div>
      </footer>

    </div>
    </>
  );
}
