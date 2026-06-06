import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, walletsTable, verificationCodesTable, systemSettingsTable, kycSubmissionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

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
    username: user.username,
    email: user.email,
    phone: user.phone ?? null,
    country: user.country,
    kycStatus: user.kycStatus,
    isMerchant: user.isMerchant,
    createdAt: user.createdAt,
  };
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).then(r => r[0]);
  return row?.value ?? null;
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
            <span style="font-size:24px;font-weight:700;">Swap</span><span style="font-size:24px;font-weight:700;color:#00e5ff;">Birr</span>
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
router.post("/send-code", async (req, res) => {
  try {
    const { target, type } = req.body ?? {};
    if (!target || !type || !["phone", "email"].includes(type)) {
      return res.status(400).json({ error: "target and type (phone|email) are required" });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(verificationCodesTable).values({ target, type, code, expiresAt });

    const isDev = process.env.NODE_ENV !== "production";

    if (type === "phone") {
      const apiKey = await getSetting("fastsmsApiKey");
      if (!apiKey) {
        if (isDev) {
          req.log.info({ target, code }, "DEV MODE — SMS not configured, OTP logged");
          console.log(`\n📱 DEV OTP for ${target}: ${code}\n`);
          return res.json({ sent: true, devCode: code });
        }
        return res.status(503).json({ error: "SMS service not configured. Contact admin." });
      }
      await sendSms(target, `Your Xendrx verification code is: ${code}. Valid for 10 minutes.`, apiKey);
    } else {
      const apiKey = await getSetting("brevoApiKey");
      const senderEmail = await getSetting("brevoSenderEmail");
      const senderName = await getSetting("brevoSenderName");
      if (!apiKey) {
        if (isDev) {
          req.log.info({ target, code }, "DEV MODE — Email not configured, OTP logged");
          console.log(`\n📧 DEV OTP for ${target}: ${code}\n`);
          return res.json({ sent: true, devCode: code });
        }
        return res.status(503).json({ error: "Email service not configured. Contact admin." });
      }
      await sendBrevoEmail(target, code, senderEmail ?? "", senderName ?? "", apiKey);
    }

    res.json({ sent: true });
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
        eq(verificationCodesTable.code, String(code)),
        eq(verificationCodesTable.used, false),
        gt(verificationCodesTable.expiresAt, now),
      ));
    const record = records[records.length - 1];
    if (!record) return res.status(400).json({ error: "Invalid or expired verification code" });

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
        eq(verificationCodesTable.code, String(code)),
        eq(verificationCodesTable.used, false),
        gt(verificationCodesTable.expiresAt, now),
      ));
    const codeRecord = codeRecords[codeRecords.length - 1];
    if (!codeRecord) return res.status(400).json({ error: "Invalid or expired verification code" });
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
    const [user] = await db.insert(usersTable).values({
      username,
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
router.post("/login", async (req, res) => {
  try {
    const { identifier, password, type, dialCode } = req.body ?? {};
    if (!identifier || !password) return res.status(400).json({ error: "identifier and password are required" });

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

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user.id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
