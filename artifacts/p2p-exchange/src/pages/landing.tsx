import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import "./landing.css";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [decimal, setDecimal] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // ── Splash loader ──────────────────────────────────────────────
  useEffect(() => {
    let p = 0;
    const ticker = setInterval(() => {
      p += Math.random() * 2.2 + 0.4;
      if (p >= 100) {
        p = 100;
        clearInterval(ticker);
        setTimeout(() => {
          setSplashDone(true);
          setTimeout(() => setSplashHidden(true), 900);
        }, 400);
      }
      setProgress(Math.min(100, p));
      setDecimal(Math.floor(Math.random() * 100));
    }, 20);
    return () => clearInterval(ticker);
  }, []);

  // ── Custom cursor ──────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
        cursorRef.current.style.opacity = "1";
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ── Scroll reveal ──────────────────────────────────────────────
  useEffect(() => {
    if (!splashHidden) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("xndr-revealed");
          }
        });
      },
      { threshold: 0.12 }
    );
    const els = mainRef.current?.querySelectorAll(".xndr-reveal") ?? [];
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [splashHidden]);

  const goAuth = useCallback(() => setLocation("/auth"), [setLocation]);

  const int = Math.floor(progress);
  const dec = String(decimal).padStart(2, "0");

  return (
    <>
      {/* Custom cursor */}
      <div ref={cursorRef} className="xndr-cursor" />

      {/* ── Splash ─────────────────────────────────────────────── */}
      {!splashHidden && (
        <div className={`xndr-splash${splashDone ? " xndr-splash--exit" : ""}`}>
          <div className="xndr-splash__logo">XENDRX</div>
          <div className="xndr-splash__rule" />
          <div className="xndr-splash__pct">
            {String(int).padStart(2, "0")}.{dec}%
          </div>
        </div>
      )}

      {/* ── Main ───────────────────────────────────────────────── */}
      <div
        ref={mainRef}
        className={`xndr-page${splashDone ? " xndr-page--visible" : ""}`}
      >
        {/* ── Navbar ─────────────────────────────────────────── */}
        <nav className="xndr-nav">
          <div className="xndr-nav__brand">XENDRX.</div>
          <div className="xndr-nav__links">
            <a href="#exchange">EXCHANGE</a>
            <a href="#markets">MARKETS</a>
            <a href="#security">SECURITY</a>
          </div>
          <button className="xndr-nav__portal" onClick={goAuth}>
            CLIENT PORTAL
          </button>
        </nav>

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="xndr-hero" id="exchange">
          <div className="xndr-hero__clouds" />
          <div className="xndr-hero__overlay" />
          <div className="xndr-hero__content">
            <p className="xndr-hero__eyebrow">PEER-TO-PEER CRYPTO EXCHANGE</p>
            <h1 className="xndr-hero__headline">
              ARCHITECTING<br />TRADES.
            </h1>
            <p className="xndr-hero__desc">
              We deploy cryptographic escrow, real-time order matching, and
              asymmetric trust protocols to construct infallible peer exchanges.
              Minimum friction. Maximum security.
            </p>
          </div>
          {/* Wireframe diamond */}
          <div className="xndr-hero__diamond">
            <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon
                points="80,12 148,52 148,108 80,148 12,108 12,52"
                stroke="#c9a84c" strokeWidth="0.7" fill="none" opacity="0.55"
              />
              <line x1="80" y1="12" x2="80" y2="148" stroke="#c9a84c" strokeWidth="0.4" opacity="0.3" />
              <line x1="12" y1="52" x2="148" y2="108" stroke="#c9a84c" strokeWidth="0.4" opacity="0.3" />
              <line x1="148" y1="52" x2="12" y2="108" stroke="#c9a84c" strokeWidth="0.4" opacity="0.3" />
              <line x1="12" y1="52" x2="148" y2="52" stroke="#c9a84c" strokeWidth="0.4" opacity="0.2" />
              <line x1="12" y1="108" x2="148" y2="108" stroke="#c9a84c" strokeWidth="0.4" opacity="0.2" />
              <circle cx="80" cy="80" r="4" fill="#c9a84c" opacity="0.9" />
              <circle cx="80" cy="80" r="10" stroke="#c9a84c" strokeWidth="0.5" opacity="0.3" />
            </svg>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────── */}
        <section className="xndr-stats">
          <div className="xndr-stat">
            <span className="xndr-stat__val">99.9</span>
            <span className="xndr-stat__unit">% UPTIME</span>
          </div>
          <div className="xndr-stat__sep" />
          <div className="xndr-stat">
            <span className="xndr-stat__val">50K+</span>
            <span className="xndr-stat__unit">ACTIVE TRADERS</span>
          </div>
          <div className="xndr-stat__sep" />
          <div className="xndr-stat">
            <span className="xndr-stat__val">&lt;1</span>
            <span className="xndr-stat__unit">s SETTLEMENT</span>
          </div>
        </section>

        {/* ── About / philosophy ─────────────────────────────── */}
        <section className="xndr-about xndr-reveal" id="markets">
          <div className="xndr-about__left">
            <h2 className="xndr-about__heading">
              The Edge of<br />Certainty
            </h2>
          </div>
          <div className="xndr-about__right">
            <p>
              In a market defined by chaos, we enforce order. Our proprietary
              escrow architecture maps every trade, locking capital with
              cryptographic precision — milliseconds before counterparty risk
              can surface.
            </p>
            <p>
              We don't predict the market; we construct the infrastructure
              necessary to thrive within it, deploying settlement rails across
              sovereign networks in 119 countries.
            </p>
          </div>
        </section>

        {/* ── Feature sections ───────────────────────────────── */}
        <section className="xndr-features" id="security">
          {[
            {
              num: "01",
              title: "Cryptographic Escrow",
              desc: "Capital frozen on-chain the moment a trade opens. Released only when both parties confirm — zero counterparty exposure at every step.",
              status: "PROTOCOL: ACTIVE",
            },
            {
              num: "02",
              title: "Global Payment Rails",
              desc: "800+ local payment methods across 119 countries. Your counterpart pays their way; USDT settles on-chain with atomic precision.",
              status: "COVERAGE: GLOBAL",
            },
            {
              num: "03",
              title: "Algorithmic Matching",
              desc: "Real-time visualization of liquidity flow across our order network. The market shifts; our topology adapts instantly with sub-second routing.",
              status: "DATA STREAM: SYNCHRONIZED",
            },
            {
              num: "04",
              title: "Zero-Trust Dispute Layer",
              desc: "Automated appeal sequencing with human arbitration fallback. Every dispute has a deterministic resolution path with full audit trail.",
              status: "SYSTEM: NOMINAL",
            },
          ].map((f) => (
            <div key={f.num} className="xndr-feature xndr-reveal">
              <div className="xndr-feature__num-col">
                <span className="xndr-feature__num">{f.num}</span>
              </div>
              <div className="xndr-feature__body">
                <h3 className="xndr-feature__title">{f.title}</h3>
                <p className="xndr-feature__desc">{f.desc}</p>
                <span className="xndr-feature__status">
                  <span className="xndr-feature__dot" />
                  {f.status}
                </span>
              </div>
              <div className="xndr-feature__line" />
            </div>
          ))}
        </section>

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="xndr-cta xndr-reveal">
          <div className="xndr-cta__inner">
            <p className="xndr-cta__label">PROTOCOL INITIATION</p>
            <h2 className="xndr-cta__heading">Initiate Trade.</h2>
            <p className="xndr-cta__sub">
              Access 50,000+ verified traders across 119 countries.<br />
              The infrastructure is ready.
            </p>
            <button className="xndr-cta__btn" onClick={goAuth}>
              BEGIN TRADING
            </button>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="xndr-footer">
          <div className="xndr-footer__contact">
            <p className="xndr-footer__contact-label">ENCRYPTED ACCESS PORTAL</p>
            <div className="xndr-footer__contact-row">
              <input
                type="email"
                placeholder="YOUR EMAIL ADDRESS"
                className="xndr-footer__input"
                onKeyDown={(e) => e.key === "Enter" && goAuth()}
              />
              <button className="xndr-footer__submit" onClick={goAuth}>
                REQUEST ACCESS
              </button>
            </div>
          </div>

          <div className="xndr-footer__rule" />

          <div className="xndr-footer__bottom">
            <div className="xndr-footer__brand">
              <div className="xndr-footer__brand-name">XENDRX.</div>
              <p className="xndr-footer__brand-desc">
                Architecting the future of decentralized<br />
                wealth through cryptographic precision.
              </p>
            </div>
            <div className="xndr-footer__col">
              <p className="xndr-footer__col-title">SERVICES</p>
              <ul>
                <li onClick={goAuth}>P2P Trading</li>
                <li onClick={goAuth}>Escrow System</li>
                <li onClick={goAuth}>Card Services</li>
                <li onClick={goAuth}>Dispute Resolution</li>
              </ul>
            </div>
            <div className="xndr-footer__col">
              <p className="xndr-footer__col-title">NETWORKS</p>
              <ul>
                <li>BEP20 / BSC</li>
                <li>USDT Stable</li>
                <li>Multi-Currency</li>
                <li>119 Countries</li>
              </ul>
            </div>
          </div>

          <div className="xndr-footer__copy">
            © 2026 XENDRX. ALL RIGHTS RESERVED. RESTRICTED ACCESS.
          </div>
        </footer>
      </div>
    </>
  );
}
