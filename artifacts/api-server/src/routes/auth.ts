import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "ethiop2p-dev-secret-change-in-production";
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

// GET /api/auth/me — verify JWT and return user
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    const user = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).then(r => r[0]);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.isSuspended) return res.status(403).json({ error: "Account suspended" });

    res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { identifier, password, username, country, dialCode, type, referral } = req.body ?? {};

    if (!identifier || !password || !username) {
      return res.status(400).json({ error: "identifier, password and username are required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (typeof username !== "string" || username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    // Validate Ethiopian phone
    if (type === "phone" && country === "ET") {
      const bare = String(identifier).replace(/\D/g, "").slice(-9);
      if (!/^[97]\d{8}$/.test(bare)) {
        return res.status(400).json({ error: "Ethiopian phone must start with 9 or 7 (9 digits)" });
      }
    }

    const isPhone = type === "phone";
    const phone = isPhone ? `${dialCode ?? ""}${identifier}` : null;
    const email = isPhone ? `${identifier}@phone.ethiop2p.com` : String(identifier).toLowerCase();

    // Check username taken
    const existingUser = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username)).then(r => r[0]);
    if (existingUser) return res.status(409).json({ error: "Username already taken" });

    // Check phone/email taken
    if (isPhone && phone) {
      const phoneExists = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.phone, phone)).then(r => r[0]);
      if (phoneExists) return res.status(409).json({ error: "Phone number already registered" });
    } else {
      const emailExists = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.email, email)).then(r => r[0]);
      if (emailExists) return res.status(409).json({ error: "Email already registered" });
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
      emailVerified: false,
      smsVerified: false,
      addressVerified: false,
    }).returning();

    // Create wallet
    await db.insert(walletsTable).values({
      userId: user.id,
      availableBalance: "0.00",
      frozenBalance: "0.00",
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "Register failed");
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Username or email already registered" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password, type, dialCode } = req.body ?? {};

    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier and password are required" });
    }

    const isPhone = type === "phone";
    let user: any;

    if (isPhone) {
      const fullPhone = `${dialCode ?? ""}${identifier}`;
      const allUsers = await db.select().from(usersTable);
      user = allUsers.find(u =>
        u.phone && (u.phone === fullPhone || u.phone.endsWith(identifier))
      );
    } else {
      user = await db.select().from(usersTable)
        .where(eq(usersTable.email, String(identifier).toLowerCase()))
        .then(r => r[0]);
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

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
