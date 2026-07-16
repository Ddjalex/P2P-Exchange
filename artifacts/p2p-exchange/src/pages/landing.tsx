import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "./landing.css";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const heroRef = useRef<HTMLElement>(null);

  // Trigger entrance animations
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Mouse-tracking parallax glow on hero
  useEffect(() => {
    function handleMouse(e: MouseEvent) {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (e.clientY > rect.bottom) return;
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    }
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  // Intersection-observer scroll reveals
  useEffect(() => {
    if (!loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-visible");
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded]);

  const glowX = mousePos.x * 100;
  const glowY = 55 + mousePos.y * 20;

  return (
    <div className={`lp-root${loaded ? " lp-loaded" : ""}`}>

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-logo">
          <span className="lp-logo-mark">◆</span>
          <span className="lp-logo-text">
            xen<span className="lp-cyan">drx</span>
          </span>
        </div>
        <div className="lp-nav-links">
          <a href="#how">How It Works</a>
          <a href="#security">Security</a>
        </div>
        <button className="lp-nav-cta" onClick={() => setLocation("/auth")}>
          Launch App
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero" ref={heroRef}>
        {/* Mouse-tracking atmospheric glow */}
        <div
          className="lp-hero-glow"
          style={{
            background: `radial-gradient(ellipse 75% 60% at ${glowX}% ${glowY}%, rgba(0,229,255,0.16) 0%, rgba(0,120,160,0.07) 45%, transparent 70%)`,
          }}
        />
        {/* Subtle grid overlay */}
        <div className="lp-hero-grid" />

        <div className="lp-hero-label">P2P Crypto Exchange · Ethiopia</div>

        <h1 className="lp-hero-headline">
          <span className="lp-hero-line1">TRADING</span>
          <span className="lp-hero-line2">USDT.</span>
        </h1>

        <p className="lp-hero-sub">
          Buy and sell USDT using Ethiopian Birr — directly peer-to-peer,
          <br />without banks, without borders.
        </p>

        <div className="lp-hero-actions">
          <button className="lp-btn-primary" onClick={() => setLocation("/auth")}>
            Start Trading
          </button>
          <a href="#how" className="lp-btn-ghost">
            How it works ↓
          </a>
        </div>

        <div className="lp-hero-stats">
          <div className="lp-stat">
            <span className="lp-stat-num">12,000+</span>
            <span className="lp-stat-label">Active Users</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num">$2.4M+</span>
            <span className="lp-stat-label">Monthly Volume</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num">800+</span>
            <span className="lp-stat-label">Payment Methods</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num">119</span>
            <span className="lp-stat-label">Countries</span>
          </div>
        </div>

        <div className="lp-scroll-hint">
          <div className="lp-scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      {/* ── SECTION 01 — HOW IT WORKS ── */}
      <section className="lp-section" id="how">
        <div className="lp-section-number lp-reveal">01</div>
        <div className="lp-section-content">
          <h2 className="lp-section-title lp-reveal">How It Works</h2>
          <p className="lp-section-desc lp-reveal">
            Peer-to-peer trading means you trade directly with other users — no
            intermediaries, no bank delays. We hold the USDT in escrow and
            release it the moment payment is confirmed.
          </p>
          <div className="lp-steps lp-reveal">
            <div className="lp-step">
              <div className="lp-step-icon">01</div>
              <h3>Post an Ad</h3>
              <p>
                List your buy or sell offer with your price, preferred payment
                methods, and trade limits.
              </p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-icon">02</div>
              <h3>Match & Chat</h3>
              <p>
                Browse live orders, pick your counterparty, and confirm the
                details via encrypted in-app chat.
              </p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-icon">03</div>
              <h3>Release & Done</h3>
              <p>
                USDT is locked in escrow. Once payment lands, funds are released
                to the buyer instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 02 — SECURITY ── */}
      <section className="lp-section" id="security">
        <div className="lp-section-number lp-reveal">02</div>
        <div className="lp-section-content">
          <h2 className="lp-section-title lp-reveal">Secure by Design</h2>
          <p className="lp-section-desc lp-reveal">
            Every trade is protected by on-chain escrow. Every trader is
            identity-verified. No single point of custody — ever.
          </p>
          <div className="lp-features lp-reveal">
            <div className="lp-feature">
              <div className="lp-feature-icon">⬡</div>
              <h3>Escrow Protection</h3>
              <p>
                USDT is locked on-chain until both parties confirm. No
                counterparty trust required.
              </p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-icon">⊛</div>
              <h3>KYC Verified</h3>
              <p>
                Every trader completes identity verification before their first
                trade — zero anonymous actors.
              </p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-icon">◈</div>
              <h3>BEP-20 Native</h3>
              <p>
                USDT on Binance Smart Chain — fast settlement, minimal fees, and
                battle-tested infrastructure.
              </p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-icon">⟁</div>
              <h3>Dispute Resolution</h3>
              <p>
                Admin-mediated disputes protect both sides in every edge case —
                no trade left unresolved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-section lp-reveal">
        <div className="lp-cta-glow" />
        <div className="lp-cta-label">Get Started Today</div>
        <h2 className="lp-cta-headline">
          Start Trading
          <br />
          in Minutes.
        </h2>
        <p className="lp-cta-sub">
          Create your account, complete KYC, and make your first trade — all
          within the day.
        </p>
        <div className="lp-cta-actions">
          <button
            className="lp-btn-primary lp-btn-large"
            onClick={() => setLocation("/auth")}
          >
            Create Account
          </button>
          <button
            className="lp-btn-outline"
            onClick={() => setLocation("/auth")}
          >
            Sign In
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <span className="lp-logo-mark">◆</span>
              <span className="lp-logo-text">
                xen<span className="lp-cyan">drx</span>
              </span>
            </div>
            <p>
              Architecting peer-to-peer crypto trade
              <br />
              for the Horn of Africa.
            </p>
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
            <div className="lp-footer-col">
              <div className="lp-footer-col-label">Network</div>
              <span>Addis Ababa</span>
              <span>Nairobi</span>
              <span>Dubai</span>
              <span>London</span>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Xendrx. All rights reserved.</span>
          <span>SWAP · TRADE · GROW</span>
        </div>
      </footer>

    </div>
  );
}
