import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import "./landing.css";

// ── Ticker data ──────────────────────────────────────────────────
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

// ── Hero image slideshow ─────────────────────────────────────────
const HERO_SLIDES = ["/hero1.jpg", "/hero-card-pay.png", "/hero-card-zero.png"];

function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setCurrent(c => {
        setPrev(c);
        return (c + 1) % HERO_SLIDES.length;
      });
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const cls = (i: number) =>
    i === current ? " xndr-hero-slide--in" :
    i === prev    ? " xndr-hero-slide--out" : "";

  return (
    <>
      {/* ── Desktop: full-hero background ── */}
      <div className="xndr-hero-slider xndr-hero-slider--bg">
        {HERO_SLIDES.map((src, i) => (
          <img key={`bg-${src}`} src={src} alt="" className={`xndr-hero-slide${cls(i)}`} />
        ))}
        <div className="xndr-hero-slider__overlay" />
      </div>

      {/* ── Mobile: inline visible image panel (shown below text) ── */}
      <div className="xndr-hero-slider xndr-hero-slider--inline">
        {HERO_SLIDES.map((src, i) => (
          <img key={`inline-${src}`} src={src} alt="Xendrx" className={`xndr-hero-slide${cls(i)}`} />
        ))}
        {/* dot indicators */}
        <div className="xndr-hero-slider__dots">
          {HERO_SLIDES.map((_, i) => (
            <span key={i} className={`xndr-slider-dot${i === current ? " xndr-slider-dot--active" : ""}`} />
          ))}
        </div>
      </div>
    </>
  );
}

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
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
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

// ── FIX #1 — Bidirectional scroll reveal ─────────────────────────
// Adds xndr-in when element enters viewport, removes it when it leaves (both directions)
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("xndr-in");
          } else {
            e.target.classList.remove("xndr-in");
          }
        });
      },
      { threshold: 0.1 }
    );
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
  const [splashPhase, setSplashPhase] = useState<"init"|"ring"|"logo"|"bar">("init");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<null|"about"|"privacy"|"terms"|"contact">(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useReveal();

  // FIX #3 — Bold phased splash: rings first, then logo, then bar
  useEffect(() => {
    // Phase timeline: init → ring (300ms) → logo (600ms) → bar (900ms) → count
    const t1 = setTimeout(() => setSplashPhase("ring"), 150);
    const t2 = setTimeout(() => setSplashPhase("logo"), 450);
    const t3 = setTimeout(() => setSplashPhase("bar"),  750);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (splashPhase !== "bar") return;
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 2.8 + 0.8;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => {
          setSplashOut(true);
          setTimeout(() => setSplashGone(true), 700);
        }, 260);
      }
      setPct(Math.min(100, Math.floor(p)));
      setDecPct(Math.floor(Math.random() * 100));
    }, 16);
    return () => clearInterval(iv);
  }, [splashPhase]);

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

  const goAuth = useCallback(() => setLocation("/auth"), [setLocation]);

  // FIX #4 — footer links do nothing (no navigation)
  const noOp = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  return (
    <>
      <div ref={cursorRef} className="xndr-cursor" />

      {/* ── FIX #3 — Bold phased splash ─────────────────────── */}
      {!splashGone && (
        <div className={`xndr-splash${splashOut ? " xndr-splash--out" : ""}`}>

          {/* scan-line overlay */}
          <div className="xndr-splash__scan" />

          {/* pulsing rings */}
          <div className={`xndr-splash__rings${splashPhase !== "init" ? " xndr-splash__rings--in" : ""}`}>
            <div className="xndr-ring xndr-ring--1" />
            <div className="xndr-ring xndr-ring--2" />
            <div className="xndr-ring xndr-ring--3" />
          </div>

          {/* logo block */}
          <div className={`xndr-splash__logo${splashPhase === "logo" || splashPhase === "bar" ? " xndr-splash__logo--in" : ""}`}>
            <svg className="xndr-splash__icon" viewBox="0 0 100 88" fill="none">
              {/* outer hex glow */}
              <polygon points="50,2 86,22 86,66 50,86 14,66 14,22"
                fill="none" stroke="#00e5ff" strokeWidth="1" opacity="0.2" />
              {/* main hex */}
              <polygon points="50,2 86,22 86,66 50,86 14,66 14,22"
                fill="#080d18" stroke="#00e5ff" strokeWidth="2"
                className="xndr-splash__hex" />
              {/* inner hex wireframe */}
              <polygon points="50,14 76,30 76,58 50,74 24,58 24,30"
                fill="none" stroke="#00e5ff" strokeWidth="0.6" opacity="0.3" />
              {/* diamond */}
              <polygon points="50,20 72,44 50,68 28,44"
                fill="none" stroke="#00e5ff" strokeWidth="2.4"
                className="xndr-splash__diamond" />
              {/* facets */}
              <polygon points="50,20 72,44 50,44" fill="#00e5ff" opacity="0.10" />
              <polygon points="28,44 50,44 50,68" fill="#00e5ff" opacity="0.06" />
              {/* center gem */}
              <polygon points="50,38 58,44 50,50 42,44" fill="#00e5ff" opacity="0.95" />
              <polygon points="50,40 56,44 50,48 44,44" fill="#b2f0ff" opacity="0.85" />
              <polygon points="50,42 53,44 50,46 47,44" fill="#fff"    opacity="0.90" />
            </svg>

            <div className="xndr-splash__text">
              <div className="xndr-splash__wordmark">
                xen<span>drx</span>
              </div>
              <div className="xndr-splash__sub">P2P CRYPTO EXCHANGE</div>
            </div>
          </div>

          {/* tagline */}
          {(splashPhase === "logo" || splashPhase === "bar") && (
            <div className="xndr-splash__tagline">SWAP · TRADE · GROW</div>
          )}

          {/* bar + counter */}
          {splashPhase === "bar" && (
            <div className="xndr-splash__bottom">
              <div className="xndr-splash__pct">
                {String(pct).padStart(2, "0")}.{String(decPct).padStart(2, "0")}%
              </div>
              <div className="xndr-splash__bar-wrap">
                <div className="xndr-splash__bar-fill" style={{ width: `${pct}%` }}>
                  <div className="xndr-splash__bar-glow" />
                </div>
              </div>
              <div className="xndr-splash__status">
                {pct < 40 ? "Initializing secure session..." :
                 pct < 70 ? "Loading market data..." :
                 pct < 90 ? "Connecting to network..." :
                            "Ready."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Page ────────────────────────────────────────────────── */}
      <div className={`xndr-page${splashGone ? " xndr-page--in" : ""}`}>

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
          {/* desktop links */}
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
          {/* mobile hamburger */}
          <button
            className={`xndr-hamburger${menuOpen ? " xndr-hamburger--open" : ""}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </nav>

        {/* ── Mobile drawer ────────────────────────────────────── */}
        <div className={`xndr-drawer${menuOpen ? " xndr-drawer--open" : ""}`}>
          <a href="#exchange" onClick={() => setMenuOpen(false)}>Exchange</a>
          <a href="#markets"  onClick={() => setMenuOpen(false)}>Markets</a>
          <a href="#how"      onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
          <div className="xndr-drawer__btns">
            <button className="xndr-btn xndr-btn--ghost" onClick={() => { setMenuOpen(false); goAuth(); }}>Sign In</button>
            <button className="xndr-btn xndr-btn--primary" onClick={() => { setMenuOpen(false); goAuth(); }}>Get Started</button>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="xndr-hero" id="exchange">
          <HeroSlider />
          <ParticleCanvas />
          <div className="xndr-hero__glow" />

          <div className="xndr-hero__left">
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

            {/* Live price ticker */}
            <div className="xndr-widget xndr-widget--compact">
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
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <section className="xndr-stats xndr-up" id="markets">
          {[
            { val: 50000,   suf: "+", label: "Active Traders" },
            { val: 119,     suf: "",  label: "Countries" },
            { val: 800,     suf: "+", label: "Payment Methods" },
            { val: 2400000, suf: "+", label: "Trades Completed" },
          ].map((s, i) => (
            <div key={i} className="xndr-stat">
              <div className="xndr-stat__val"><Counter to={s.val} suffix={s.suf} /></div>
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
                n: "01", title: "Create Account",
                desc: "Sign up in 60 seconds. Complete quick KYC verification to unlock full trading access.",
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>),
              },
              {
                n: "02", title: "Browse Offers",
                desc: "Find the best rates across 800+ payment methods. Filter by amount, currency, and payment type.",
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M8 6V4m8 2V4"/></svg>),
              },
              {
                n: "03", title: "Trade Securely",
                desc: "USDT locks in escrow. Pay your counterpart. Escrow releases automatically on confirmation.",
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>),
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

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="xndr-features" id="security">
          <div className="xndr-section-label xndr-up">BUILT FOR SECURITY</div>
          <h2 className="xndr-section-title xndr-up">Why Xendrx</h2>
          <div className="xndr-feat-grid">
            {[
              { icon: "🔒", title: "Cryptographic Escrow",    tag: "Zero counterparty risk", desc: "USDT locks on-chain the moment a trade opens. Released only after both parties confirm." },
              { icon: "⚡", title: "Sub-Second Settlement",   tag: "< 1s typical",           desc: "BEP20 BSC infrastructure delivers settlement in milliseconds, not hours." },
              { icon: "🌍", title: "Global Payment Rails",    tag: "119 countries",           desc: "800+ payment methods across 119 countries. Bank Transfer, Mobile Money, PayPal, Wise, and more." },
              { icon: "🛡️", title: "Verified Traders",       tag: "KYC verified",            desc: "KYC-verified counterparties with reputation scores, trade history, and completion rates." },
              { icon: "⚖️", title: "Dispute Resolution",     tag: "24h resolution",          desc: "Dedicated arbitration team resolves disputes within hours. Full trade chat audit trail." },
              { icon: "💳", title: "Virtual Cards",           tag: "Instant issuance",        desc: "Instantly convert USDT to a virtual Visa/Mastercard for global online purchases." },
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

        {/* ── CTA ───────────────────────────────────────────────── */}
        <section className="xndr-cta xndr-up">
          <div className="xndr-cta__glow" />
          <div className="xndr-cta__content">
            <div className="xndr-section-label">GET STARTED TODAY</div>
            <h2 className="xndr-cta__title">Ready to Trade?</h2>
            <p className="xndr-cta__desc">Join 50,000+ traders on the most secure P2P crypto exchange.</p>
            <div className="xndr-cta__btns">
              <button className="xndr-btn xndr-btn--primary xndr-btn--xl" onClick={goAuth}>Create Free Account</button>
              <button className="xndr-btn xndr-btn--ghost xndr-btn--xl" onClick={goAuth}>View Live Markets</button>
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
                { title: "Platform", links: [
                    { label: "P2P Trading",       action: noOp },
                    { label: "Escrow System",     action: noOp },
                    { label: "Virtual Cards",     action: noOp },
                    { label: "Dispute Resolution",action: noOp },
                ]},
                { title: "Company", links: [
                    { label: "About",          action: (e: React.MouseEvent) => { e.preventDefault(); setModal("about"); } },
                    { label: "Privacy Policy", action: (e: React.MouseEvent) => { e.preventDefault(); setModal("privacy"); } },
                    { label: "Terms",          action: (e: React.MouseEvent) => { e.preventDefault(); setModal("terms"); } },
                    { label: "Contact Us",     action: (e: React.MouseEvent) => { e.preventDefault(); setModal("contact"); } },
                ]},
                { title: "Support", links: [
                    { label: "Help Center",   action: noOp },
                    { label: "Security Tips", action: noOp },
                    { label: "KYC Guide",     action: noOp },
                    { label: "API Docs",      action: noOp },
                ]},
              ].map(col => (
                <div key={col.title} className="xndr-footer__col">
                  <p className="xndr-footer__col-title">{col.title}</p>
                  <ul>
                    {col.links.map(l => (
                      <li key={l.label}>
                        <a href="#" onClick={l.action}>{l.label}</a>
                      </li>
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

      {/* ── Info Modals ───────────────────────────────────────── */}
      {modal && (
        <div className="xndr-modal-backdrop" onClick={() => setModal(null)}>
          <div className="xndr-modal" onClick={e => e.stopPropagation()}>
            <button className="xndr-modal__close" onClick={() => setModal(null)} aria-label="Close">✕</button>

            {modal === "about" && (
              <>
                <h2 className="xndr-modal__title">About Xendrx</h2>
                <div className="xndr-modal__body">
                  <p>Xendrx is a peer-to-peer USDT exchange built for the next generation of global traders. We connect buyers and sellers directly — no middlemen, no hidden fees, no counterparty risk.</p>
                  <h3>Our Mission</h3>
                  <p>To make crypto trading accessible, secure, and instant for everyone, everywhere. We support 119 countries and over 800 payment methods so you can trade in the way that works for you.</p>
                  <h3>How We Work</h3>
                  <p>Every trade on Xendrx is protected by cryptographic escrow on the BEP20 / BSC network. USDT is locked on-chain the moment a trade is initiated and released automatically once both parties confirm — no trust required.</p>
                  <h3>Our Numbers</h3>
                  <ul>
                    <li>50,000+ active traders worldwide</li>
                    <li>2,400,000+ completed trades</li>
                    <li>800+ accepted payment methods</li>
                    <li>119 countries supported</li>
                  </ul>
                </div>
              </>
            )}

            {modal === "privacy" && (
              <>
                <h2 className="xndr-modal__title">Privacy Policy</h2>
                <div className="xndr-modal__body">
                  <p><em>Effective date: January 1, 2026</em></p>
                  <h3>1. Information We Collect</h3>
                  <p>We collect your name, email address, phone number, and identity documents during KYC verification. We also collect trade history, transaction metadata, and device/session information to operate the platform securely.</p>
                  <h3>2. How We Use Your Data</h3>
                  <p>Your data is used to verify your identity, facilitate trades, prevent fraud, comply with applicable regulations, and improve our services. We never sell your personal data to third parties.</p>
                  <h3>3. Data Security</h3>
                  <p>All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is restricted to authorised personnel on a need-to-know basis. We undergo regular security audits.</p>
                  <h3>4. Your Rights</h3>
                  <p>You may request access to, correction of, or deletion of your personal data at any time by contacting our support team. Account deletion requests are processed within 30 days.</p>
                  <h3>5. Contact</h3>
                  <p>Privacy inquiries: <strong>privacy@xendrx.com</strong></p>
                </div>
              </>
            )}

            {modal === "terms" && (
              <>
                <h2 className="xndr-modal__title">Terms of Service</h2>
                <div className="xndr-modal__body">
                  <p><em>Effective date: January 1, 2026</em></p>
                  <h3>1. Acceptance</h3>
                  <p>By accessing or using Xendrx you agree to these Terms. If you do not agree, do not use the platform.</p>
                  <h3>2. Eligibility</h3>
                  <p>You must be at least 18 years old and not located in a jurisdiction where P2P crypto trading is prohibited. You are responsible for compliance with your local laws.</p>
                  <h3>3. Account & KYC</h3>
                  <p>You must complete KYC verification to unlock full trading access. Providing false information is grounds for immediate account suspension.</p>
                  <h3>4. Trading Rules</h3>
                  <p>All trades are bound by our escrow system. Attempting to manipulate trades, defraud counterparties, or circumvent escrow will result in permanent account termination and may be reported to relevant authorities.</p>
                  <h3>5. Fees</h3>
                  <p>Xendrx charges a small platform fee on completed trades. Fee schedules are displayed before you confirm any trade.</p>
                  <h3>6. Disputes</h3>
                  <p>Disputes must be raised within 24 hours of a trade deadline. Our arbitration team reviews all evidence and makes a binding decision.</p>
                  <h3>7. Liability</h3>
                  <p>Xendrx is not liable for losses arising from market volatility, user error, or third-party payment delays. Our maximum liability is limited to fees paid in the 30 days preceding a claim.</p>
                </div>
              </>
            )}

            {modal === "contact" && (
              <>
                <h2 className="xndr-modal__title">Contact Us</h2>
                <div className="xndr-modal__body xndr-modal__body--contact">
                  <div className="xndr-contact-grid">
                    <div className="xndr-contact-card">
                      <span className="xndr-contact-card__icon">💬</span>
                      <h3>Live Support</h3>
                      <p>Available 24/7 via in-app chat once you are logged in.</p>
                      <button className="xndr-btn xndr-btn--primary" onClick={goAuth}>Open Chat</button>
                    </div>
                    <div className="xndr-contact-card">
                      <span className="xndr-contact-card__icon">📧</span>
                      <h3>Email</h3>
                      <p>For general enquiries and partnership requests.</p>
                      <a href="mailto:support@xendrx.com" className="xndr-btn xndr-btn--secondary">support@xendrx.com</a>
                    </div>
                    <div className="xndr-contact-card">
                      <span className="xndr-contact-card__icon">🛡️</span>
                      <h3>Dispute Team</h3>
                      <p>Raise a trade dispute directly from your order page once logged in.</p>
                      <button className="xndr-btn xndr-btn--ghost" onClick={goAuth}>Go to Orders</button>
                    </div>
                    <div className="xndr-contact-card">
                      <span className="xndr-contact-card__icon">🔐</span>
                      <h3>Security</h3>
                      <p>Report vulnerabilities responsibly to our security team.</p>
                      <a href="mailto:security@xendrx.com" className="xndr-btn xndr-btn--ghost">security@xendrx.com</a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
