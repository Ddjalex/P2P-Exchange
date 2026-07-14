import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import "./landing.css";

// ── Simulated live trade data ────────────────────────────────────
const TRADE_POOL = [
  { user: "Ahmad K.", action: "bought", amt: "200", cur: "USDT", pay: "Bank Transfer", ago: "2s" },
  { user: "Sarah M.", action: "sold",   amt: "500", cur: "USDT", pay: "PayPal",        ago: "7s" },
  { user: "James O.", action: "bought", amt: "1,200",cur:"USDT", pay: "M-Pesa",        ago: "12s" },
  { user: "Layla H.", action: "sold",   amt: "350", cur: "USDT", pay: "Wise",          ago: "18s" },
  { user: "Bui T.",   action: "bought", amt: "750", cur: "USDT", pay: "Bank Transfer", ago: "23s" },
  { user: "Omar A.",  action: "sold",   amt: "2,000",cur:"USDT", pay: "Cash Deposit",  ago: "31s" },
  { user: "Priya N.", action: "bought", amt: "400", cur: "USDT", pay: "Revolut",       ago: "44s" },
  { user: "Carlos V.",action: "sold",   amt: "900", cur: "USDT", pay: "Bank Transfer", ago: "51s" },
  { user: "Fatima Z.",action: "bought", amt: "150", cur: "USDT", pay: "PayPal",        ago: "1m" },
  { user: "Arjun P.", action: "sold",   amt: "3,000",cur:"USDT", pay: "IMPS",          ago: "1m" },
  { user: "Mei L.",   action: "bought", amt: "600", cur: "USDT", pay: "Alipay",        ago: "2m" },
  { user: "Kwame O.", action: "sold",   amt: "250", cur: "USDT", pay: "MTN Mobile",    ago: "2m" },
];

const TICKER_ITEMS = [
  "🟢 Ahmad K. bought 200 USDT via Bank Transfer",
  "🔵 Sarah M. sold 500 USDT via PayPal",
  "🟢 James O. bought 1,200 USDT via M-Pesa",
  "🔵 Layla H. sold 350 USDT via Wise",
  "🟢 Bui T. bought 750 USDT via Bank Transfer",
  "🔵 Omar A. sold 2,000 USDT via Cash Deposit",
  "🟢 Priya N. bought 400 USDT via Revolut",
  "🔵 Carlos V. sold 900 USDT via Bank Transfer",
  "🟢 Fatima Z. bought 150 USDT via PayPal",
  "🔵 Arjun P. sold 3,000 USDT via IMPS",
  "🟢 Mei L. bought 600 USDT via Alipay",
  "🔵 Kwame O. sold 250 USDT via MTN Mobile",
];

const BUY_ADS = [
  { price: "1.002", limit: "100 – 5,000", method: "Bank Transfer", rate: "+0.2%" },
  { price: "1.001", limit: "50 – 2,000",  method: "PayPal",        rate: "+0.1%" },
  { price: "1.000", limit: "200 – 10,000",method: "Wise",          rate: "0.0%" },
  { price: "0.999", limit: "100 – 3,000", method: "Revolut",       rate: "-0.1%" },
];

// ── Canvas particle network ──────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 55;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.5,
    }));

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(0,229,255,${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,229,255,0.5)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="xndr-canvas" />;
}

// ── Animated counter ─────────────────────────────────────────────
function Counter({ to, suffix = "", duration = 1800 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(Math.floor(ease * to));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(to);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Live feed row ────────────────────────────────────────────────
interface FeedRow { id: number; user: string; action: string; amt: string; pay: string; ts: string }

// ── Scroll reveal hook ───────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("xndr-in"); });
    }, { threshold: 0.1 });
    document.querySelectorAll(".xndr-up").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ── Typewriter ───────────────────────────────────────────────────
function Typewriter({ lines, speed = 42 }: { lines: string[]; speed?: number }) {
  const [displayed, setDisplayed] = useState<string[]>(["", ""]);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const line = lines[lineIdx] ?? "";
    if (charIdx < line.length) {
      const t = setTimeout(() => {
        setDisplayed(prev => {
          const next = [...prev];
          next[lineIdx] = line.slice(0, charIdx + 1);
          return next;
        });
        setCharIdx(c => c + 1);
      }, speed);
      return () => clearTimeout(t);
    } else if (lineIdx < lines.length - 1) {
      const t = setTimeout(() => { setLineIdx(l => l + 1); setCharIdx(0); }, 200);
      return () => clearTimeout(t);
    } else {
      setDone(true);
    }
  }, [lineIdx, charIdx, done, lines, speed]);

  return (
    <>
      {displayed.map((txt, i) => (
        <span key={i} className="xndr-hero__line">
          {txt}
          {!done && i === lineIdx && <span className="xndr-caret" />}
        </span>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [pct, setPct] = useState(0);
  const [decPct, setDecPct] = useState(0);
  const [splashOut, setSplashOut] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const feedId = useRef(0);
  const cursorRef = useRef<HTMLDivElement>(null);

  useReveal();

  // Splash
  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 2.6 + 0.6;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => {
          setSplashOut(true);
          setTimeout(() => setSplashGone(true), 750);
        }, 300);
      }
      setPct(Math.min(100, Math.floor(p)));
      setDecPct(Math.floor(Math.random() * 100));
    }, 18);
    return () => clearInterval(iv);
  }, []);

  // Custom cursor
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 6}px,${e.clientY - 6}px)`;
        cursorRef.current.style.opacity = "1";
      }
    };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  // Live feed
  useEffect(() => {
    if (!splashGone) return;
    // Seed with a few entries
    const initial: FeedRow[] = TRADE_POOL.slice(0, 4).map((t, i) => ({
      id: i, user: t.user, action: t.action, amt: t.amt, pay: t.pay,
      ts: t.ago,
    }));
    setFeed(initial);
    feedId.current = 4;

    const iv = setInterval(() => {
      const t = TRADE_POOL[Math.floor(Math.random() * TRADE_POOL.length)];
      const newRow: FeedRow = {
        id: feedId.current++, user: t.user, action: t.action,
        amt: t.amt, pay: t.pay, ts: "just now",
      };
      setFeed(prev => [newRow, ...prev].slice(0, 8));
    }, 2800);
    return () => clearInterval(iv);
  }, [splashGone]);

  const goAuth = useCallback(() => setLocation("/auth"), [setLocation]);

  return (
    <>
      <div ref={cursorRef} className="xndr-cursor" />

      {/* ── Splash ─────────────────────────────────────────────── */}
      {!splashGone && (
        <div className={`xndr-splash${splashOut ? " xndr-splash--out" : ""}`}>
          <div className="xndr-splash__logo">
            {/* Diamond icon */}
            <svg className="xndr-splash__icon" viewBox="0 0 100 88" fill="none">
              <polygon points="50,2 86,22 86,66 50,86 14,66 14,22" fill="#080d18" stroke="#00e5ff" strokeWidth="2" />
              <polygon points="50,14 76,30 76,58 50,74 24,58 24,30" fill="none" stroke="#00e5ff" strokeWidth="0.6" opacity="0.3" />
              <polygon points="50,20 72,44 50,68 28,44" fill="none" stroke="#00e5ff" strokeWidth="2.2" />
              <polygon points="50,38 58,44 50,50 42,44" fill="#00e5ff" opacity="0.95" />
              <polygon points="50,40 56,44 50,48 44,44" fill="#b2f0ff" opacity="0.8" />
            </svg>
            <span className="xndr-splash__wordmark">
              xen<span>drx</span>
            </span>
          </div>
          <div className="xndr-splash__tagline">SWAP · TRADE · GROW</div>
          <div className="xndr-splash__rule" />
          <div className="xndr-splash__pct">
            {String(pct).padStart(2, "0")}.{String(decPct).padStart(2, "0")}%
          </div>
          <div className="xndr-splash__bar-wrap">
            <div className="xndr-splash__bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* ── Page ────────────────────────────────────────────────── */}
      <div className={`xndr-page${splashGone ? " xndr-page--in" : ""}`}>

        {/* ── Live ticker ──────────────────────────────────────── */}
        <div className="xndr-ticker">
          <span className="xndr-ticker__badge">● LIVE</span>
          <div className="xndr-ticker__track">
            <div className="xndr-ticker__inner">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className="xndr-ticker__item">{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Navbar ───────────────────────────────────────────── */}
        <nav className="xndr-nav">
          <div className="xndr-nav__brand">
            <svg viewBox="0 0 40 38" fill="none" className="xndr-nav__icon">
              <polygon points="20,1 37,10 37,28 20,37 3,28 3,10" fill="#080d18" stroke="#00e5ff" strokeWidth="1.5" />
              <polygon points="20,9 30,15 30,25 20,31 10,25 10,15" fill="none" stroke="#00e5ff" strokeWidth="0.5" opacity="0.25" />
              <polygon points="20,10 30,19 20,28 10,19" fill="none" stroke="#00e5ff" strokeWidth="1.6" />
              <polygon points="20,16 24,19 20,22 16,19" fill="#00e5ff" opacity="0.95" />
              <polygon points="20,17 23,19 20,21 17,19" fill="#fff" opacity="0.8" />
            </svg>
            <span className="xndr-nav__wordmark">xen<span>drx</span></span>
          </div>
          <div className="xndr-nav__links">
            <a href="#exchange">Exchange</a>
            <a href="#markets">Markets</a>
            <a href="#how">How It Works</a>
            <a href="#security">Security</a>
          </div>
          <div className="xndr-nav__actions">
            <button className="xndr-btn xndr-btn--ghost" onClick={goAuth}>Sign In</button>
            <button className="xndr-btn xndr-btn--primary" onClick={goAuth}>Get Started</button>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="xndr-hero" id="exchange">
          <ParticleCanvas />
          <div className="xndr-hero__glow" />

          <div className="xndr-hero__left">
            <div className="xndr-hero__badge">
              <span className="xndr-hero__dot" /> Live · 50,000+ Traders Online
            </div>
            <h1 className="xndr-hero__headline">
              <Typewriter lines={["Trade USDT", "Peer-to-Peer."]} speed={40} />
            </h1>
            <p className="xndr-hero__sub">
              Buy and sell USDT directly with verified traders worldwide.
              Cryptographic escrow. Zero counterparty risk.
              119 countries · 800+ payment methods.
            </p>
            <div className="xndr-hero__ctas">
              <button className="xndr-btn xndr-btn--primary xndr-btn--lg" onClick={goAuth}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm3.5 8.5h-7a.5.5 0 010-1h7a.5.5 0 010 1z"/></svg>
                Buy USDT
              </button>
              <button className="xndr-btn xndr-btn--secondary xndr-btn--lg" onClick={goAuth}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm.5 7.5V5.5a.5.5 0 00-1 0v4H5.5a.5.5 0 000 1H9.5v4a.5.5 0 001 0v-4h4a.5.5 0 000-1H10.5z"/></svg>
                Sell USDT
              </button>
            </div>
            <div className="xndr-hero__trust">
              <span>🔒 Escrow Protected</span>
              <span>⚡ &lt;1s Settlement</span>
              <span>🌍 119 Countries</span>
            </div>
          </div>

          {/* Live P2P widget */}
          <div className="xndr-hero__right">
            <div className="xndr-widget">
              <div className="xndr-widget__head">
                <div>
                  <div className="xndr-widget__title">USDT / USD</div>
                  <div className="xndr-widget__price">1.0018 <span className="up">▲ +0.18%</span></div>
                </div>
                <div className="xndr-widget__tabs">
                  <button className="active">Buy</button>
                  <button>Sell</button>
                </div>
              </div>

              {/* Sparkline */}
              <div className="xndr-sparkline-wrap">
                <svg className="xndr-sparkline" viewBox="0 0 300 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="xndr-spark__fill" d="M0,50 L30,42 L60,38 L90,44 L120,30 L150,26 L180,32 L210,18 L240,22 L270,12 L300,8 L300,60 L0,60 Z" fill="url(#sg)" />
                  <path className="xndr-spark__line" d="M0,50 L30,42 L60,38 L90,44 L120,30 L150,26 L180,32 L210,18 L240,22 L270,12 L300,8" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Order book headers */}
              <div className="xndr-widget__cols">
                <span>Price (USD)</span>
                <span>Limit</span>
                <span>Method</span>
                <span></span>
              </div>

              {/* Offers */}
              <div className="xndr-widget__offers">
                {BUY_ADS.map((ad, i) => (
                  <div key={i} className="xndr-offer" style={{ animationDelay: `${i * 0.1}s` }}>
                    <span className={`xndr-offer__price ${parseFloat(ad.rate) >= 0 ? "up" : "dn"}`}>{ad.price}</span>
                    <span className="xndr-offer__limit">{ad.limit}</span>
                    <span className="xndr-offer__method">{ad.method}</span>
                    <button className="xndr-offer__btn" onClick={goAuth}>Buy</button>
                  </div>
                ))}
              </div>

              <button className="xndr-widget__more" onClick={goAuth}>
                View all offers →
              </button>
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <section className="xndr-stats xndr-up" id="markets">
          {[
            { val: 50000,  suf: "+", label: "Active Traders" },
            { val: 119,    suf: "",  label: "Countries" },
            { val: 800,    suf: "+", label: "Payment Methods" },
            { val: 2400000,suf: "+", label: "Trades Completed" },
          ].map((s, i) => (
            <div key={i} className="xndr-stat">
              <div className="xndr-stat__val">
                <Counter to={s.val} suffix={s.suf} />
              </div>
              <div className="xndr-stat__label">{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="xndr-how" id="how">
          <div className="xndr-section-label xndr-up">HOW IT WORKS</div>
          <h2 className="xndr-section-title xndr-up">Trade in 3 Steps</h2>
          <div className="xndr-steps">
            {[
              {
                n: "01",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                ),
                title: "Create Account",
                desc: "Sign up in 60 seconds. Complete quick KYC verification to unlock full trading access.",
              },
              {
                n: "02",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="6" width="18" height="13" rx="2"/>
                    <path d="M3 10h18M8 6V4m8 2V4"/>
                  </svg>
                ),
                title: "Browse Offers",
                desc: "Find the best rates across 800+ payment methods. Filter by amount, currency, and payment type.",
              },
              {
                n: "03",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/>
                  </svg>
                ),
                title: "Trade Securely",
                desc: "USDT locks in escrow. Pay your counterpart. Escrow releases automatically on confirmation.",
              },
            ].map((step, i) => (
              <div key={i} className="xndr-step xndr-up" style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="xndr-step__num">{step.n}</div>
                <div className="xndr-step__icon">{step.icon}</div>
                <h3 className="xndr-step__title">{step.title}</h3>
                <p className="xndr-step__desc">{step.desc}</p>
                {i < 2 && <div className="xndr-step__arrow">→</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Live trade feed ───────────────────────────────────── */}
        <section className="xndr-live-section">
          <div className="xndr-live-section__left xndr-up">
            <div className="xndr-section-label">REAL-TIME ACTIVITY</div>
            <h2 className="xndr-section-title">Live Trade Feed</h2>
            <p className="xndr-section-desc">
              Thousands of P2P trades happen on Xendrx every minute.
              Every transaction is escrow-protected and fully auditable.
            </p>
            <div className="xndr-live-stats">
              <div className="xndr-live-stat">
                <span className="xndr-live-stat__dot buy" />
                <span className="xndr-live-stat__label">Buy orders</span>
                <span className="xndr-live-stat__val">2,841</span>
              </div>
              <div className="xndr-live-stat">
                <span className="xndr-live-stat__dot sell" />
                <span className="xndr-live-stat__label">Sell orders</span>
                <span className="xndr-live-stat__val">1,906</span>
              </div>
            </div>
            <button className="xndr-btn xndr-btn--primary" onClick={goAuth}>
              Start Trading Now
            </button>
          </div>
          <div className="xndr-feed">
            <div className="xndr-feed__head">
              <span className="xndr-feed__live">● LIVE</span>
              <span>Recent Trades</span>
            </div>
            <div className="xndr-feed__list">
              {feed.map(row => (
                <div key={row.id} className={`xndr-feed__row xndr-feed__row--${row.action === "bought" ? "buy" : "sell"} xndr-feed__row--new`}>
                  <div className={`xndr-feed__dot ${row.action === "bought" ? "buy" : "sell"}`} />
                  <div className="xndr-feed__info">
                    <span className="xndr-feed__user">{row.user}</span>
                    <span className={`xndr-feed__action ${row.action === "bought" ? "buy" : "sell"}`}>
                      {row.action} {row.amt} USDT
                    </span>
                  </div>
                  <div className="xndr-feed__right">
                    <span className="xndr-feed__method">{row.pay}</span>
                    <span className="xndr-feed__ts">{row.ts}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="xndr-features" id="security">
          <div className="xndr-section-label xndr-up">BUILT FOR SECURITY</div>
          <h2 className="xndr-section-title xndr-up">Why Xendrx</h2>
          <div className="xndr-feat-grid">
            {[
              {
                icon: "🔒",
                title: "Cryptographic Escrow",
                desc: "USDT locks on-chain the moment a trade opens. Released only after both parties confirm.",
                tag: "Zero counterparty risk",
              },
              {
                icon: "⚡",
                title: "Sub-Second Settlement",
                desc: "BEP20 BSC infrastructure delivers settlement in milliseconds, not hours.",
                tag: "< 1s typical",
              },
              {
                icon: "🌍",
                title: "Global Payment Rails",
                desc: "800+ payment methods across 119 countries. Bank Transfer, Mobile Money, PayPal, Wise, and more.",
                tag: "119 countries",
              },
              {
                icon: "🛡️",
                title: "Verified Traders",
                desc: "KYC-verified counterparties with reputation scores, trade history, and completion rates.",
                tag: "KYC verified",
              },
              {
                icon: "⚖️",
                title: "Dispute Resolution",
                desc: "Dedicated arbitration team resolves disputes within hours. Full trade chat audit trail.",
                tag: "24h resolution",
              },
              {
                icon: "💳",
                title: "Virtual Cards",
                desc: "Instantly convert USDT to a virtual Visa/Mastercard for global online purchases.",
                tag: "Instant issuance",
              },
            ].map((f, i) => (
              <div key={i} className="xndr-feat xndr-up" style={{ transitionDelay: `${(i % 3) * 0.1}s` }}>
                <div className="xndr-feat__icon">{f.icon}</div>
                <h3 className="xndr-feat__title">{f.title}</h3>
                <p className="xndr-feat__desc">{f.desc}</p>
                <span className="xndr-feat__tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA banner ────────────────────────────────────────── */}
        <section className="xndr-cta xndr-up">
          <div className="xndr-cta__glow" />
          <div className="xndr-cta__content">
            <div className="xndr-section-label">GET STARTED TODAY</div>
            <h2 className="xndr-cta__title">Ready to Trade?</h2>
            <p className="xndr-cta__desc">
              Join 50,000+ traders on the most secure P2P crypto exchange.
            </p>
            <div className="xndr-cta__btns">
              <button className="xndr-btn xndr-btn--primary xndr-btn--xl" onClick={goAuth}>
                Create Free Account
              </button>
              <button className="xndr-btn xndr-btn--ghost xndr-btn--xl" onClick={goAuth}>
                View Live Markets
              </button>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="xndr-footer">
          <div className="xndr-footer__top">
            <div className="xndr-footer__brand">
              <div className="xndr-footer__logo">
                <svg viewBox="0 0 40 38" fill="none" className="xndr-nav__icon">
                  <polygon points="20,1 37,10 37,28 20,37 3,28 3,10" fill="#080d18" stroke="#00e5ff" strokeWidth="1.5" />
                  <polygon points="20,10 30,19 20,28 10,19" fill="none" stroke="#00e5ff" strokeWidth="1.6" />
                  <polygon points="20,16 24,19 20,22 16,19" fill="#00e5ff" opacity="0.95" />
                </svg>
                <span className="xndr-footer__wordmark">xen<span>drx</span></span>
              </div>
              <p className="xndr-footer__slogan">Swap · Trade · Grow</p>
              <p className="xndr-footer__about">
                The most secure peer-to-peer crypto exchange. Trade USDT with verified counterparties worldwide.
              </p>
            </div>
            <div className="xndr-footer__cols">
              {[
                { title: "Platform", links: ["P2P Trading", "Escrow System", "Virtual Cards", "Dispute Resolution"] },
                { title: "Company",  links: ["About",      "Privacy Policy", "Terms",          "Contact Us"] },
                { title: "Support",  links: ["Help Center","Security Tips",  "KYC Guide",      "API Docs"] },
              ].map(col => (
                <div key={col.title} className="xndr-footer__col">
                  <p className="xndr-footer__col-title">{col.title}</p>
                  <ul>
                    {col.links.map(l => (
                      <li key={l}><a onClick={goAuth} href="#">{l}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="xndr-footer__bottom">
            <span>© 2026 Xendrx. All rights reserved.</span>
            <div className="xndr-footer__badges">
              <span>🔒 SSL Secured</span>
              <span>✅ KYC Verified</span>
              <span>⚡ BEP20 / BSC</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
