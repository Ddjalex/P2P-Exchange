import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db } from "@workspace/db";
import { usersTable, walletsTable, verificationCodesTable, systemSettingsTable, kycSubmissionsTable, notificationsTable, passwordResetTokensTable, telegramUsersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { checkSendAbility, sendTelegramOtp, checkTelegramOtp, formatToE164 } from "../lib/telegram-gateway.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
});

const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Please wait 15 minutes and try again." },
});

const JWT_SECRET = process.env.JWT_SECRET || "xendrx-dev-secret-change-in-production";
const JWT_EXPIRES = "30d";

function signToken(userId: number) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token: string): { sub: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { sub: Number(decoded.sub) };
  } catch {
    return null;
  }
}

function formatUser(user: any) {
  return {
    id: user.id,
    uid: user.uid ?? null,
    username: user.username,
    email: user.email,
    phone: user.phone ?? null,
    country: user.country,
    kycStatus: user.kycStatus,
    isMerchant: user.isMerchant,
    emailVerified: user.emailVerified ?? false,
    smsVerified: user.smsVerified ?? false,
    addressVerified: user.addressVerified ?? false,
    addressVerifiedAt: user.addressVerifiedAt ?? null,
    createdAt: user.createdAt,
  };
}

function generateUID(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).then(r => r[0]);
  return row?.value ?? null;
}

async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  // In development, always pass — avoids blocking logins without a real Turnstile widget
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = (await res.json()) as any;
  return data.success === true;
}

async function sendSms(phone: string, message: string, apiKey: string): Promise<void> {
  const res = await fetch("https://fastsms.dev/api/p/sms/send", {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: phone, message }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("SMS service authentication failed. Please update your FastSMS API key in Admin → Settings.");
    }
    throw new Error(`SMS service error (${res.status})${body ? ": " + body : ""}. Contact admin.`);
  }
}

async function sendBrevoEmail(to: string, code: string, senderEmail: string, senderName: string, apiKey: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName || "Xendrx", email: senderEmail || "noreply@xendrx.com" },
      to: [{ email: to }],
      subject: "Your Verification Code",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#080d18;color:#fff;border-radius:12px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:24px;font-weight:700;color:#00e5ff;">Xendrx</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:20px;">Verification Code</h2>
          <p style="color:rgba(255,255,255,.6);font-size:14px;margin:0 0 24px;">Use the code below to verify your account. It expires in 10 minutes.</p>
          <div style="background:#0d0d1a;border:2px solid #00e5ff33;border-radius:8px;padding:20px;text-align:center;letter-spacing:10px;font-size:36px;font-weight:700;color:#00e5ff;">${code}</div>
          <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:24px;text-align:center;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${body}`);
  }
}

// POST /api/auth/send-code
router.post("/send-code", sendCodeLimiter, async (req, res) => {
  try {
    const { target, type, turnstileToken } = req.body ?? {};
    if (!target || !type || !["phone", "email"].includes(type)) {
      return res.status(400).json({ error: "target and type (phone|email) are required" });
    }
    // Skip Turnstile for already-authenticated users (e.g. adding phone from settings)
    const authHeader = req.headers.authorization;
    const isAuthenticated = !!(authHeader?.startsWith("Bearer ") && verifyToken(authHeader.slice(7)));
    if (!isAuthenticated && !(await verifyTurnstile(turnstileToken, req.ip))) {
      return res.status(400).json({ error: "Security check failed. Please try again." });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const isDev = process.env.NODE_ENV !== "production";

    if (type === "phone") {
      const phoneE164 = formatToE164(target);
      console.log('[Auth] Attempting Telegram Gateway OTP for:', phoneE164);

      const abilityCheck = await checkSendAbility(phoneE164);
      console.log('[Auth] Telegram checkSendAbility result:', JSON.stringify(abilityCheck));

      if (abilityCheck?.request_id) {
        const sendResult = await sendTelegramOtp(phoneE164, abilityCheck.request_id);
        console.log('[Auth] Telegram sendVerificationMessage result:', JSON.stringify(sendResult));
        if (sendResult?.request_id) {
          await db.insert(verificationCodesTable).values({
            target, type, code: 'TELEGRAM', expiresAt, method: 'telegram', telegramRequestId: sendResult.request_id,
          });
          console.log('[Auth] OTP method chosen: telegram for phone:', target);
          return res.json({ sent: true, method: 'telegram' });
        }
      }

      // Fallback to SMS
      console.log('[Auth] Telegram unavailable for:', phoneE164, '— falling back to SMS');
      const code = generateCode();
      await db.insert(verificationCodesTable).values({ target, type, code, expiresAt, method: 'sms' });

      const apiKey = await getSetting("fastsmsApiKey");
      if (!apiKey) {
        if (isDev) {
          req.log.info({ target, code }, "DEV MODE — SMS not configured, OTP logged");
          console.log(`\n📱 DEV OTP for ${target}: ${code}\n`);
          return res.json({ sent: true, devCode: code, method: 'sms' });
        }
        return res.status(503).json({ error: "SMS service not configured. Contact admin." });
      }
      await sendSms(target, `Your Xendrx verification code is: ${code}. Valid for 10 minutes.`, apiKey);
      console.log('[Auth] OTP method chosen: sms for phone:', target);
      return res.json({ sent: true, method: 'sms' });
    } else {
      // Email
      const code = generateCode();
      await db.insert(verificationCodesTable).values({ target, type, code, expiresAt, method: 'email' });

      const apiKey = await getSetting("brevoApiKey");
      const senderEmail = await getSetting("brevoSenderEmail");
      const senderName = await getSetting("brevoSenderName");
      if (!apiKey) {
        if (isDev) {
          req.log.info({ target, code }, "DEV MODE — Email not configured, OTP logged");
          console.log(`\n📧 DEV OTP for ${target}: ${code}\n`);
          return res.json({ sent: true, devCode: code, method: 'email' });
        }
        return res.status(503).json({ error: "Email service not configured. Contact admin." });
      }
      await sendBrevoEmail(target, code, senderEmail ?? "", senderName ?? "", apiKey);
      console.log('[Auth] OTP method chosen: email for target:', target);
      return res.json({ sent: true, method: 'email' });
    }
  } catch (err: any) {
    req.log.error({ err }, "send-code failed");
    res.status(500).json({ error: err?.message || "Failed to send verification code" });
  }
});

// POST /api/auth/verify-code
router.post("/verify-code", async (req, res) => {
  try {
    const { target, code } = req.body ?? {};
    if (!target || !code) return res.status(400).json({ error: "target and code are required" });

    const now = new Date();
    const records = await db.select().from(verificationCodesTable)
      .where(and(
        eq(verificationCodesTable.target, target),
        eq(verificationCodesTable.used, false),
        gt(verificationCodesTable.expiresAt, now),
      ));
    const record = records[records.length - 1];
    if (!record) return res.status(400).json({ error: "Invalid or expired verification code" });

    if (record.method === 'telegram' && record.telegramRequestId) {
      const isValid = await checkTelegramOtp(record.telegramRequestId, String(code));
      console.log('[Auth] Telegram code verification result:', isValid);
      if (!isValid) return res.status(400).json({ error: "Invalid or expired code" });
    } else {
      if (record.code !== String(code)) return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    await db.update(verificationCodesTable).set({ used: true }).where(eq(verificationCodesTable.id, record.id));
    res.json({ verified: true });
  } catch (err) {
    req.log.error({ err }, "verify-code failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    const user = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).then(r => r[0]);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.isSuspended) return res.status(403).json({ error: "Account suspended" });
    const kyc = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, user.id)).then(r => r[0]);
    res.json({ ...formatUser(user), kycFullName: kyc?.fullName ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { identifier, password, username, country, dialCode, type, referral, code } = req.body ?? {};

    if (!identifier || !password || !username) {
      return res.status(400).json({ error: "identifier, password and username are required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (typeof username !== "string" || username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    if (type === "phone" && country === "ET") {
      const bare = String(identifier).replace(/\D/g, "").slice(-9);
      if (!/^[97]\d{8}$/.test(bare)) {
        return res.status(400).json({ error: "Ethiopian phone must start with 9 or 7 (9 digits)" });
      }
    }

    const isPhone = type === "phone";
    const phone = isPhone ? `${dialCode ?? ""}${identifier}` : null;
    const email = isPhone ? `${identifier}@phone.xendrx.com` : String(identifier).toLowerCase();
    const codeTarget = isPhone ? phone! : email;

    // Verify OTP
    if (!code) return res.status(400).json({ error: "Verification code is required" });
    const now = new Date();
    const codeRecords = await db.select().from(verificationCodesTable)
      .where(and(
        eq(verificationCodesTable.target, codeTarget),
        eq(verificationCodesTable.used, false),
        gt(verificationCodesTable.expiresAt, now),
      ));
    const codeRecord = codeRecords[codeRecords.length - 1];
    if (!codeRecord) return res.status(400).json({ error: "Invalid or expired verification code" });

    if (codeRecord.method === 'telegram' && codeRecord.telegramRequestId) {
      const isValid = await checkTelegramOtp(codeRecord.telegramRequestId, String(code));
      console.log('[Auth] Telegram register code verification result:', isValid);
      if (!isValid) return res.status(400).json({ error: "Invalid or expired verification code" });
    } else {
      if (codeRecord.code !== String(code)) return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    await db.update(verificationCodesTable).set({ used: true }).where(eq(verificationCodesTable.id, codeRecord.id));

    // Check username taken
    const existingUser = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username)).then(r => r[0]);
    if (existingUser) return res.status(409).json({ error: "Username already taken" });

    // Check phone/email taken
    if (isPhone && phone) {
      const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).then(r => r[0]);
      if (exists) return res.status(409).json({ error: "Phone number already registered" });
    } else {
      const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).then(r => r[0]);
      if (exists) return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let finalUid = generateUID();
    for (let attempts = 0; attempts < 10; attempts++) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.uid, finalUid)).then(r => r[0]);
      if (!existing) break;
      finalUid = generateUID();
    }

    const [user] = await db.insert(usersTable).values({
      username,
      uid: finalUid,
      email,
      phone: phone ?? undefined,
      country: country || "Ethiopia",
      passwordHash,
      kycStatus: "none",
      isMerchant: false,
      emailVerified: !isPhone,
      smsVerified: isPhone,
      addressVerified: false,
    }).returning();

    await db.insert(walletsTable).values({
      userId: user.id,
      availableBalance: "0.00",
      frozenBalance: "0.00",
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "Register failed");
    if (err?.code === "23505") return res.status(409).json({ error: "Username or email already registered" });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { identifier, password, type, dialCode, turnstileToken } = req.body ?? {};
    if (!identifier || !password) return res.status(400).json({ error: "identifier and password are required" });
    if (!(await verifyTurnstile(turnstileToken, req.ip))) {
      return res.status(400).json({ error: "Security check failed. Please try again." });
    }

    const isPhone = type === "phone";
    let user: any;

    if (isPhone) {
      const fullPhone = `${dialCode ?? ""}${identifier}`;
      const allUsers = await db.select().from(usersTable);
      user = allUsers.find(u => u.phone && (u.phone === fullPhone || u.phone.endsWith(identifier)));
    } else {
      user = await db.select().from(usersTable)
        .where(eq(usersTable.email, String(identifier).toLowerCase())).then(r => r[0]);
    }

    if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
    if (user.isSuspended) return res.status(403).json({ error: "Account suspended" });

    // Account lockout check
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return res.status(423).json({ error: `Account temporarily locked due to too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const LOCK_THRESHOLD = 5;
      if (attempts >= LOCK_THRESHOLD) {
        const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        await db.update(usersTable).set({ failedLoginAttempts: attempts, lockedUntil }).where(eq(usersTable.id, user.id));
        await db.insert(notificationsTable).values({
          userId: user.id,
          type: "system",
          title: "🔒 Account Temporarily Locked",
          message: "Your account has been locked for 30 minutes due to 5 consecutive failed login attempts. If this wasn't you, consider changing your password.",
        });
      } else {
        await db.update(usersTable).set({ failedLoginAttempts: attempts }).where(eq(usersTable.id, user.id));
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Successful login — reset lockout counters
    await db.update(usersTable).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(usersTable.id, user.id));

    const token = signToken(user.id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── FORGOT PASSWORD FLOW ──────────────────────────────────────────────────────

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset attempts. Please wait 15 minutes." },
});

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/forgot-password — Step 1: send OTP
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { identifier } = req.body ?? {};
    if (!identifier) {
      return res.status(400).json({ message: "Email or phone number required" });
    }

    const normalized = String(identifier).trim();
    const isEmail = normalized.includes("@");
    const isDev = process.env.NODE_ENV !== "production";

    // Find user by email or phone (tolerant phone matching)
    const allUsers = await db.select().from(usersTable);
    const user = allUsers.find(u => {
      if (isEmail) return u.email === normalized.toLowerCase();
      // Phone: match full stored number OR the last N digits
      const bare = normalized.replace(/\D/g, "");
      return u.phone && (u.phone === normalized || u.phone.replace(/\D/g, "").endsWith(bare));
    });

    if (!user) {
      // Don't reveal whether the account exists
      return res.json({ success: true, message: "If this account exists, a reset code has been sent." });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Delete old tokens for this user and save the new one
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: otp,
      identifier: normalized,
      expiresAt,
      used: false,
    });

    req.log.info({ target: normalized }, "Password reset OTP generated");
    console.log(`\n🔐 RESET OTP for ${normalized}: ${otp}\n`);

    let delivered = false;
    let deliveryError = "";

    if (isEmail) {
      // Try Brevo email delivery
      const apiKey = await getSetting("brevoApiKey");
      const senderEmail = await getSetting("brevoSenderEmail");
      const senderName = await getSetting("brevoSenderName");
      if (apiKey) {
        try {
          const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#080d18;color:#fff;border-radius:12px;padding:32px;">
              <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:24px;font-weight:700;">xen</span><span style="font-size:24px;font-weight:700;color:#00e5ff;">drx</span>
              </div>
              <h2 style="margin:0 0 8px;font-size:20px;">Password Reset Code</h2>
              <p style="color:rgba(255,255,255,.6);font-size:14px;margin:0 0 24px;">Use the code below to reset your password. It expires in 15 minutes.</p>
              <div style="background:#0d0d1a;border:2px solid #00e5ff33;border-radius:8px;padding:20px;text-align:center;letter-spacing:10px;font-size:36px;font-weight:700;color:#00e5ff;">${otp}</div>
              <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:24px;text-align:center;">If you did not request this, ignore this email.</p>
            </div>
          `;
          const res2 = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: senderName || "Xendrx", email: senderEmail || "noreply@xendrx.com" },
              to: [{ email: normalized }],
              subject: "Your Xendrx Password Reset Code",
              htmlContent: emailHtml,
            }),
          });
          if (res2.ok) delivered = true;
          else deliveryError = `Email error ${res2.status}`;
        } catch (e: any) {
          deliveryError = e?.message || "Email send failed";
        }
      } else {
        deliveryError = "Email service not configured";
      }
    } else {
      // Try FastSMS delivery
      const apiKey = await getSetting("fastsmsApiKey");
      if (apiKey) {
        try {
          const phone = user.phone || normalized;
          await sendSms(phone, `Your Xendrx password reset code is: ${otp}. Valid for 15 minutes. Do not share this code.`, apiKey);
          delivered = true;
        } catch (e: any) {
          deliveryError = e?.message || "SMS send failed";
        }
      } else {
        deliveryError = "SMS service not configured";
      }
    }

    // Try Telegram as fallback (or in addition) if user has bot linked
    const tgUser = await db.select().from(telegramUsersTable)
      .where(eq(telegramUsersTable.userId, user.id)).then(r => r[0]);
    if (tgUser?.telegramId) {
      try {
        const { sendTelegramMessage } = await import("../telegram/bot.js");
        await sendTelegramMessage(
          tgUser.telegramId,
          `🔐 *Xendrx Password Reset*\n\nYour reset code is:\n\n\`${otp}\`\n\nThis code expires in *15 minutes*.\nIf you did not request this, ignore this message.`
        );
        delivered = true;
      } catch {
        // Telegram is optional
      }
    }

    if (!delivered) {
      req.log.warn({ deliveryError }, "OTP delivery failed, returning devOtp");
    }

    return res.json({
      success: true,
      message: delivered
        ? `Reset code sent to your ${isEmail ? "email" : "phone"}.`
        : "Reset code sent successfully.",
      // Always expose in dev mode so testing works without configured services
      ...(isDev && { devOtp: otp }),
    });
  } catch (err: any) {
    req.log.error({ err }, "forgot-password failed");
    return res.status(500).json({ message: "Failed to send reset code. Try again." });
  }
});

// POST /api/auth/verify-reset-otp — Step 2: verify OTP
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { identifier, otp } = req.body ?? {};
    if (!identifier || !otp) {
      return res.status(400).json({ message: "Identifier and OTP required" });
    }

    const resetToken = await db.select().from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.identifier, String(identifier)),
        eq(passwordResetTokensTable.token, String(otp)),
        eq(passwordResetTokensTable.used, false),
      )).then(r => r[0]);

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid reset code" });
    }
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: "Reset code has expired. Request a new one." });
    }

    return res.json({ success: true, message: "Code verified successfully" });
  } catch (err: any) {
    req.log.error({ err }, "verify-reset-otp failed");
    return res.status(500).json({ message: "Verification failed. Try again." });
  }
});

// POST /api/auth/reset-password — Step 3: set new password
router.post("/reset-password", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body ?? {};
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const resetToken = await db.select().from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.identifier, String(identifier)),
        eq(passwordResetTokensTable.token, String(otp)),
        eq(passwordResetTokensTable.used, false),
      )).then(r => r[0]);

    if (!resetToken || !resetToken.userId) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: "Reset code expired. Request a new one." });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    await db.update(usersTable)
      .set({ passwordHash: hashedPassword })
      .where(eq(usersTable.id, resetToken.userId));

    await db.update(passwordResetTokensTable)
      .set({ used: true })
      .where(eq(passwordResetTokensTable.id, resetToken.id));

    // Telegram confirmation (optional)
    const tgUser = await db.select().from(telegramUsersTable)
      .where(eq(telegramUsersTable.userId, resetToken.userId)).then(r => r[0]);
    if (tgUser?.telegramId) {
      try {
        const { sendTelegramMessage } = await import("../telegram/bot.js");
        sendTelegramMessage(
          tgUser.telegramId,
          `✅ *Password Reset Successful*\n\nYour Xendrx password has been changed.\nIf this was not you, contact support@xendrx.com immediately.`
        ).catch(() => {});
      } catch {
        // Telegram is optional
      }
    }

    return res.json({ success: true, message: "Password reset successfully! You can now login." });
  } catch (err: any) {
    req.log.error({ err }, "reset-password failed");
    return res.status(500).json({ message: "Password reset failed. Try again." });
  }
});

export default router;
