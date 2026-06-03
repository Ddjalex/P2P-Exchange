import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import "./auth.css";

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: "ET", name: "Ethiopia",       dial: "+251", flag: "🇪🇹" },
  { code: "GB", name: "United Kingdom", dial: "+44",  flag: "🇬🇧" },
  { code: "US", name: "United States",  dial: "+1",   flag: "🇺🇸" },
  { code: "DE", name: "Germany",        dial: "+49",  flag: "🇩🇪" },
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷" },
  { code: "IT", name: "Italy",          dial: "+39",  flag: "🇮🇹" },
  { code: "ES", name: "Spain",          dial: "+34",  flag: "🇪🇸" },
  { code: "NL", name: "Netherlands",    dial: "+31",  flag: "🇳🇱" },
  { code: "SE", name: "Sweden",         dial: "+46",  flag: "🇸🇪" },
  { code: "NO", name: "Norway",         dial: "+47",  flag: "🇳🇴" },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦" },
  { code: "AU", name: "Australia",      dial: "+61",  flag: "🇦🇺" },
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya",          dial: "+254", flag: "🇰🇪" },
  { code: "GH", name: "Ghana",          dial: "+233", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa",   dial: "+27",  flag: "🇿🇦" },
  { code: "TZ", name: "Tanzania",       dial: "+255", flag: "🇹🇿" },
  { code: "UG", name: "Uganda",         dial: "+256", flag: "🇺🇬" },
  { code: "SD", name: "Sudan",          dial: "+249", flag: "🇸🇩" },
  { code: "SO", name: "Somalia",        dial: "+252", flag: "🇸🇴" },
  { code: "DJ", name: "Djibouti",       dial: "+253", flag: "🇩🇯" },
  { code: "ER", name: "Eritrea",        dial: "+291", flag: "🇪🇷" },
  { code: "IN", name: "India",          dial: "+91",  flag: "🇮🇳" },
  { code: "CN", name: "China",          dial: "+86",  flag: "🇨🇳" },
  { code: "JP", name: "Japan",          dial: "+81",  flag: "🇯🇵" },
  { code: "AE", name: "UAE",            dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia",   dial: "+966", flag: "🇸🇦" },
  { code: "EG", name: "Egypt",          dial: "+20",  flag: "🇪🇬" },
  { code: "BR", name: "Brazil",         dial: "+55",  flag: "🇧🇷" },
  { code: "RU", name: "Russia",         dial: "+7",   flag: "🇷🇺" },
  { code: "TR", name: "Turkey",         dial: "+90",  flag: "🇹🇷" },
  { code: "PK", name: "Pakistan",       dial: "+92",  flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh",     dial: "+880", flag: "🇧🇩" },
];

const ET = COUNTRIES[0];

export default function AuthPage() {
  const { user, isLoading, login } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const [, setLocation] = useLocation();

  const [toggled, setToggled] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  // Login state
  const [loginC, setLoginC] = useState<Country>(ET);
  const [loginType, setLoginType] = useState<"phone" | "email">("phone");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginPhoneErr, setLoginPhoneErr] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginPhoneFocused, setLoginPhoneFocused] = useState(false);

  // Register state
  const [regC, setRegC] = useState<Country>(ET);
  const [regType, setRegType] = useState<"phone" | "email">("phone");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regRef, setRegRef] = useState("");
  const [regPhoneErr, setRegPhoneErr] = useState(false);
  const [regErr, setRegErr] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regPhoneFocused, setRegPhoneFocused] = useState(false);

  // Admin login state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPwd, setAdminPwd] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // Country modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState<"login" | "reg">("login");
  const [modalSearch, setModalSearch] = useState("");
  const [loginPillOpen, setLoginPillOpen] = useState(false);
  const [regPillOpen, setRegPillOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/wallet");
    }
  }, [user, isLoading, setLocation]);

  // ESC closes modal / admin mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        setAdminMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function openModal(ctx: "login" | "reg") {
    setModalCtx(ctx);
    setModalSearch("");
    setModalOpen(true);
    if (ctx === "login") setLoginPillOpen(true);
    else setRegPillOpen(true);
    setTimeout(() => searchRef.current?.focus(), 200);
  }

  function closeModal() {
    setModalOpen(false);
    setLoginPillOpen(false);
    setRegPillOpen(false);
  }

  function pickCountry(code: string) {
    const c = COUNTRIES.find(x => x.code === code)!;
    const isET = c.code === "ET";
    if (modalCtx === "login") {
      setLoginC(c);
      if (!isET) setLoginType("email");
      else setLoginType("phone");
    } else {
      setRegC(c);
      if (!isET) setRegType("email");
      else setRegType("phone");
    }
    closeModal();
  }

  const filteredCountries = COUNTRIES.filter(c => {
    const q = modalSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dial.includes(q)
    );
  });

  async function doLogin() {
    setLoginErr("");
    if (loginType === "phone") {
      if (loginC.code === "ET" && !/^[97]\d{8}$/.test(loginPhone)) {
        setLoginPhoneErr(true);
        return;
      }
    }
    setLoginPhoneErr(false);

    const identifier = loginType === "phone" ? loginPhone : loginEmail;
    if (!identifier || !loginPwd) {
      setLoginErr("Please fill in all fields");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password: loginPwd,
          country: loginC.code,
          dialCode: loginC.dial,
          type: loginType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginErr(data.error || "Login failed");
        return;
      }
      login(data.token, data.user);
      setLocation("/wallet");
    } catch {
      setLoginErr("Network error. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function doRegister() {
    setRegErr("");
    if (regType === "phone") {
      if (regC.code === "ET" && !/^[97]\d{8}$/.test(regPhone)) {
        setRegPhoneErr(true);
        return;
      }
    }
    setRegPhoneErr(false);

    const identifier = regType === "phone" ? regPhone : regEmail;
    if (!identifier || !regPwd || !regUser) {
      setRegErr("Please fill in all required fields");
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password: regPwd,
          username: regUser,
          country: regC.code,
          dialCode: regC.dial,
          type: regType,
          referral: regRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegErr(data.error || "Registration failed");
        return;
      }
      login(data.token, data.user);
      setLocation("/wallet");
    } catch {
      setRegErr("Network error. Please try again.");
    } finally {
      setRegLoading(false);
    }
  }

  async function doAdminLogin() {
    setAdminErr("");
    if (!adminEmail || !adminPwd) {
      setAdminErr("Email and password are required");
      return;
    }
    setAdminLoading(true);
    try {
      await adminLogin(adminEmail, adminPwd);
      setLocation("/admin/dashboard");
    } catch (err: any) {
      setAdminErr(err.message || "Login failed");
    } finally {
      setAdminLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="auth-root">
        <div style={{ color: "#00d4ff", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      {/* Country Modal */}
      <div
        className={`country-modal-overlay${modalOpen ? " open" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      >
        <div className="country-modal">
          <div className="modal-header">
            <h3>Select Country</h3>
            <button className="modal-close" onClick={closeModal}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-search">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name or dial code…"
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-list">
            {filteredCountries.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 13 }}>
                No countries found
              </div>
            ) : filteredCountries.map(c => {
              const cur = modalCtx === "login" ? loginC : regC;
              const active = cur.code === c.code;
              return (
                <div
                  key={c.code}
                  className={`modal-item${active ? " active" : ""}`}
                  onClick={() => pickCountry(c.code)}
                >
                  <span className="m-flag">{c.flag}</span>
                  <div className="m-info">
                    <div className="m-name">{c.name}</div>
                    <div className="m-iso">{c.code}</div>
                  </div>
                  <span className="m-dial">{c.dial}</span>
                  <i className="fa-solid fa-check m-check"></i>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="auth-logo">Ethio<span>P2P</span></div>

      {/* Auth Wrapper */}
      <div className={`auth-wrapper${toggled && !adminMode ? " toggled" : ""}${adminMode ? " admin-mode" : ""}`}>
        <div className="background-shape"></div>
        <div className="secondary-shape"></div>

        {/* ══ ADMIN LOGIN PANEL (overlays when adminMode = true) ══ */}
        <div className={`admin-panel${adminMode ? " visible" : ""}`}>
          <div className="admin-panel-inner">
            <div className="admin-badge">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Admin Access</span>
            </div>
            <h2>Admin Login</h2>
            <p className="admin-subtitle">Authorized personnel only</p>

            <div className="field-wrapper" style={{ marginTop: 24 }}>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
              />
              <label>Admin Email</label>
              <i className="fa-solid fa-envelope"></i>
            </div>

            <div className="field-wrapper">
              <input
                type="password"
                value={adminPwd}
                onChange={e => setAdminPwd(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doAdminLogin()}
                required
              />
              <label>Password</label>
              <i className="fa-solid fa-lock"></i>
            </div>

            <button
              className="submit-btn"
              style={{ marginTop: 20 }}
              onClick={doAdminLogin}
              disabled={adminLoading}
            >
              {adminLoading ? "Signing in…" : "Sign In as Admin"}
            </button>
            {adminErr && <div className="server-err">{adminErr}</div>}

            <div className="switch-link" style={{ marginTop: 16 }}>
              <a onClick={() => { setAdminMode(false); setAdminErr(""); }}>
                <i className="fa-solid fa-arrow-left" style={{ marginRight: 5, fontSize: 10 }}></i>
                Back to user login
              </a>
            </div>
          </div>
        </div>

        {/* ══ LOGIN PANEL ══ */}
        <div className="credentials-panel signin">
          <h2 className="slide-element">Login</h2>

          {/* Country Pill */}
          <div className="country-pill-wrap slide-element">
            <div className="country-pill-label">Country</div>
            <div
              className={`country-pill${loginPillOpen ? " open" : ""}`}
              onClick={() => openModal("login")}
            >
              <span className="pill-flag">{loginC.flag}</span>
              <div className="pill-info">
                <span className="pill-name">{loginC.name}</span>
                <span className="pill-code">{loginC.code} · {loginC.dial}</span>
              </div>
              <i className="fa-solid fa-chevron-down pill-caret"></i>
            </div>
          </div>

          {/* Phone/Email tabs (ET only) */}
          {loginC.code === "ET" && (
            <div className="input-tabs slide-element">
              <button
                className={loginType === "phone" ? "active" : ""}
                onClick={() => setLoginType("phone")}
              >
                <span className="tab-icon">📱</span>
                <span className="tab-label">Phone</span>
              </button>
              <button
                className={loginType === "email" ? "active" : ""}
                onClick={() => setLoginType("email")}
              >
                <span className="tab-icon">✉️</span>
                <span className="tab-label">Email</span>
              </button>
            </div>
          )}

          {/* Phone input */}
          {loginType === "phone" && (
            <div className="phone-row-wrap slide-element">
              <div className="phone-row-label">Phone Number</div>
              <div className={`phone-row${loginPhoneFocused ? " focused" : ""}`}>
                <div className="phone-prefix">
                  <span className="pf-flag">{loginC.flag}</span>
                  <span className="pf-code">{loginC.dial}</span>
                </div>
                <input
                  type="tel"
                  placeholder="9XX XXX XXXX"
                  value={loginPhone}
                  onChange={e => setLoginPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  onFocus={() => setLoginPhoneFocused(true)}
                  onBlur={() => setLoginPhoneFocused(false)}
                />
                <i className="fa-solid fa-phone"></i>
              </div>
              <div className={`auth-err${loginPhoneErr ? " show" : ""}`}>
                Invalid phone number (must start with 9 or 7)
              </div>
            </div>
          )}

          {/* Email input */}
          {loginType === "email" && (
            <div className="field-wrapper slide-element">
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
              />
              <label>Email Address</label>
              <i className="fa-solid fa-envelope"></i>
            </div>
          )}

          {/* Password */}
          <div className="field-wrapper slide-element">
            <input
              type="password"
              value={loginPwd}
              onChange={e => setLoginPwd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doLogin()}
              required
            />
            <label>Password</label>
            <i className="fa-solid fa-lock"></i>
          </div>

          <div className="forgot slide-element"><a href="#">Forgot password?</a></div>

          <div className="slide-element">
            <button className="submit-btn" onClick={doLogin} disabled={loginLoading}>
              {loginLoading ? "Logging in…" : "Login"}
            </button>
            {loginErr && <div className="server-err">{loginErr}</div>}
          </div>

          <div className="switch-link slide-element">
            Don't have an account?{" "}
            <a onClick={() => setToggled(true)}>Sign Up</a>
          </div>
        </div>

        {/* Welcome right */}
        <div className="welcome-section signin">
          <h2 className="slide-element">WELCOME<br />BACK!</h2>
          <p className="slide-element">Trade crypto safely with EthioP2P</p>
        </div>

        {/* ══ REGISTER PANEL ══ */}
        <div className="credentials-panel signup">
          <h2 className="slide-element">Register</h2>

          {/* Country Pill */}
          <div className="country-pill-wrap slide-element">
            <div className="country-pill-label">Country</div>
            <div
              className={`country-pill${regPillOpen ? " open" : ""}`}
              onClick={() => openModal("reg")}
            >
              <span className="pill-flag">{regC.flag}</span>
              <div className="pill-info">
                <span className="pill-name">{regC.name}</span>
                <span className="pill-code">{regC.code} · {regC.dial}</span>
              </div>
              <i className="fa-solid fa-chevron-down pill-caret"></i>
            </div>
          </div>

          {/* Phone/Email tabs (ET only) */}
          {regC.code === "ET" && (
            <div className="input-tabs slide-element">
              <button
                className={regType === "phone" ? "active" : ""}
                onClick={() => setRegType("phone")}
              >
                <span className="tab-icon">📱</span>
                <span className="tab-label">Phone</span>
              </button>
              <button
                className={regType === "email" ? "active" : ""}
                onClick={() => setRegType("email")}
              >
                <span className="tab-icon">✉️</span>
                <span className="tab-label">Email</span>
              </button>
            </div>
          )}

          {/* Phone input */}
          {regType === "phone" && (
            <div className="phone-row-wrap slide-element">
              <div className="phone-row-label">Phone Number</div>
              <div className={`phone-row${regPhoneFocused ? " focused" : ""}`}>
                <div className="phone-prefix">
                  <span className="pf-flag">{regC.flag}</span>
                  <span className="pf-code">{regC.dial}</span>
                </div>
                <input
                  type="tel"
                  placeholder="9XX XXX XXXX"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  onFocus={() => setRegPhoneFocused(true)}
                  onBlur={() => setRegPhoneFocused(false)}
                />
                <i className="fa-solid fa-phone"></i>
              </div>
              <div className={`auth-err${regPhoneErr ? " show" : ""}`}>
                Ethiopian number must start with 9 or 7
              </div>
            </div>
          )}

          {/* Email input */}
          {regType === "email" && (
            <div className="field-wrapper slide-element">
              <input
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
              />
              <label>Email Address</label>
              <i className="fa-solid fa-envelope"></i>
            </div>
          )}

          {/* Username */}
          <div className="field-wrapper slide-element">
            <input
              type="text"
              value={regUser}
              onChange={e => setRegUser(e.target.value)}
              required
            />
            <label>Username</label>
            <i className="fa-solid fa-user"></i>
          </div>

          {/* Password */}
          <div className="field-wrapper slide-element">
            <input
              type="password"
              value={regPwd}
              onChange={e => setRegPwd(e.target.value)}
              required
            />
            <label>Password</label>
            <i className="fa-solid fa-lock"></i>
          </div>

          {/* Referral */}
          <div className="field-wrapper slide-element">
            <input
              type="text"
              value={regRef}
              onChange={e => setRegRef(e.target.value)}
            />
            <label>Referral Code (optional)</label>
            <i className="fa-solid fa-gift"></i>
          </div>

          <div className="slide-element">
            <button className="submit-btn" onClick={doRegister} disabled={regLoading}>
              {regLoading ? "Creating account…" : "Create Account"}
            </button>
            {regErr && <div className="server-err">{regErr}</div>}
          </div>

          <div className="switch-link slide-element">
            Already have an account?{" "}
            <a onClick={() => setToggled(false)}>Sign In</a>
          </div>
        </div>

        {/* Welcome left */}
        <div className="welcome-section signup">
          <h2 className="slide-element">JOIN<br />ETHIO<br />P2P!</h2>
          <p className="slide-element">Ethiopia's trusted P2P exchange</p>
        </div>
      </div>

      {/* Admin toggle link */}
      <div className="admin-toggle-link">
        {adminMode ? null : (
          <a onClick={() => { setAdminMode(true); setAdminErr(""); }}>
            <i className="fa-solid fa-shield-halved"></i> Admin Access
          </a>
        )}
      </div>
    </div>
  );
}
