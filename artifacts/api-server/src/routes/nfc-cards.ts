import { Router } from "express";
import { db } from "@workspace/db";
import {
  cardsTable,
  cardQueueTable,
  kycSubmissionsTable,
  usersTable,
  walletsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, or, and, like, gte, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userAuth } from "../middleware/user-auth";
import { enqueueCardFund, enqueueCardCreate } from "../lib/card-queue.js";
import { PushNotify } from "./push.js";
import { checkVelocity, checkBalance, checkDailyLimit, auditLog } from "../middleware/security.js";
import { sendBrevoEmail, getSetting } from "./auth.js";
import { verificationCodesTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

const STRO_BASE = "https://strowallet.com/api/bitvcard";

function stroMessageToString(msg: any): string {
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') {
    return Object.entries(msg)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
  }
  return String(msg ?? '');
}

async function getCardSettings() {
  const rows = await db.select().from(systemSettingsTable).where(
    or(
      eq(systemSettingsTable.key, "cardCreationFee"),
      eq(systemSettingsTable.key, "cardInitialLoad"),
      eq(systemSettingsTable.key, "cardMinFund"),
    )
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    cardCreationFee: map.cardCreationFee ?? "2.00",
    cardInitialLoad: map.cardInitialLoad ?? "3.00",
    cardMinFund: map.cardMinFund ?? "2.00",
  };
}

// Resolves which of a user's (possibly multiple) cards a request refers to.
// If an explicit id is given, it must belong to this user (ownership check).
// If not given, falls back to the most recent non-terminated card — keeps
// older frontend builds working without an id param during rollout.
async function resolveUserCard(userId: number, requestedId?: string | number) {
  if (requestedId) {
    const parsedId = parseInt(String(requestedId), 10);
    if (!isNaN(parsedId)) {
      const card = await db.query.cardsTable.findFirst({ where: and(eq(cardsTable.id, parsedId), eq(cardsTable.userId, userId)) });
      return card ?? null;
    }
  }
  const rows = await db.select().from(cardsTable).where(and(
    eq(cardsTable.userId, userId),
    sql`card_status NOT IN (\'terminated\',\'inactive\')`
  )).orderBy(sql`created_at DESC`).limit(1);
  return rows[0] ?? null;
}

function generateCardEmailOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// POST /api/cards/email-otp/send — sends a 6-digit code to a personal email for card creation
router.post("/email-otp/send", userAuth, async (req: any, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (email.endsWith("@phone.xendrx.com")) {
      return res.status(400).json({ error: "Please use your real personal email, not a placeholder." });
    }
    const code = generateCardEmailOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(verificationCodesTable).values({ target: email, type: "card_email_otp", code, expiresAt, method: "email" });
    const apiKey = await getSetting("brevoApiKey");
    const senderEmail = await getSetting("brevoSenderEmail");
    const senderName = await getSetting("brevoSenderName");
    const isDev = process.env.NODE_ENV !== "production";
    if (!apiKey) {
      if (isDev) {
        console.log(`[Card] DEV MODE — email OTP for ${email}: ${code}`);
        return res.json({ sent: true, devCode: code });
      }
      return res.status(503).json({ error: "Email service not configured. Contact admin." });
    }
    await sendBrevoEmail(email, code, senderEmail ?? "", senderName ?? "", apiKey);
    return res.json({ sent: true });
  } catch (err) {
    console.error("[Card] email-otp/send error:", err);
    return res.status(500).json({ error: "Could not send verification code. Please try again." });
  }
});

// POST /api/cards/email-otp/verify — verifies the 6-digit code sent above
router.post("/email-otp/verify", userAuth, async (req: any, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const code = String(req.body?.code ?? "").trim();
    if (!email || !code) return res.status(400).json({ error: "Email and code are required." });
    const rows = await db.select().from(verificationCodesTable).where(and(
      eq(verificationCodesTable.target, email),
      eq(verificationCodesTable.type, "card_email_otp"),
      eq(verificationCodesTable.code, code),
      eq(verificationCodesTable.used, false)
    )).orderBy(desc(verificationCodesTable.createdAt)).limit(1);
    const row = rows[0];
    if (!row) return res.status(400).json({ error: "Incorrect code. Please try again." });
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "This code has expired. Please request a new one." });
    }
    await db.update(verificationCodesTable).set({ used: true }).where(eq(verificationCodesTable.id, row.id));
    return res.json({ verified: true });
  } catch (err) {
    console.error("[Card] email-otp/verify error:", err);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// GET /api/cards/list — returns all of this user's cards (for multi-card support)
router.get("/list", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const cards = await db.select().from(cardsTable).where(eq(cardsTable.userId, userId)).orderBy(sql`created_at DESC`);
    res.json({ cards });
  } catch (err) {
    console.error("[Card] list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/fees — public endpoint for frontend to show dynamic fee info
router.get("/fees", async (_req, res) => {
  try {
    const settings = await getCardSettings();
    const creationFee = parseFloat(settings.cardCreationFee);
    const initialLoad = parseFloat(settings.cardInitialLoad);
    res.json({
      cardCreationFee: settings.cardCreationFee,
      cardInitialLoad: settings.cardInitialLoad,
      cardMinFund: settings.cardMinFund,
      totalRequired: (creationFee + initialLoad).toFixed(2),
    });
  } catch {
    res.json({ cardCreationFee: "2.00", cardInitialLoad: "3.00", cardMinFund: "2.00", totalRequired: "5.00" });
  }
});

function cleanKey(k: string | undefined): string {
  return (k || "").replace(/\s+/g, "");
}

function maskKey(k: string | undefined): string {
  const c = cleanKey(k);
  if (!c) return "(empty)";
  if (c.length <= 8) return `(${c.length} chars — too short)`;
  return `${c.slice(0, 4)}...${c.slice(-4)} (${c.length} chars)`;
}

// Log key shape on startup so we can verify the correct keys are loaded
console.log(`[StroWallet] public_key shape: ${maskKey(process.env.STROWALLET_PUBLIC_KEY)}`);
console.log(`[StroWallet] secret_key shape: ${maskKey(process.env.STROWALLET_SECRET_KEY)}`);

function stroBaseUrl(path: string): URL {
  const url = new URL(`${STRO_BASE}/${path}`);
  url.searchParams.set("public_key", cleanKey(process.env.STROWALLET_PUBLIC_KEY));
  url.searchParams.set("secret_key", cleanKey(process.env.STROWALLET_SECRET_KEY));
  url.searchParams.set("mode", "live");
  return url;
}

async function fetchCardDetails(cardId: string): Promise<any> {
  const url = stroBaseUrl("fetch-nfccard-detail");
  url.searchParams.set("card_id", cardId);
  const res = await fetch(url.toString());
  const raw = await res.json();
  console.log("[Card] fetchCardDetails response:", JSON.stringify(raw));
  return raw?.response?.card_detail ?? raw?.response?.card ?? raw?.response ?? raw;
}

// StroWallet now requires an international-format phone number (e.g. +251...).
// Local Ethiopian numbers are stored as "0..." — normalize just for their API,
// without touching the user's actual stored contact number.
function normalizeEthPhoneForStro(raw: string | null | undefined): string {
  const p = (raw ?? "").trim();
  if (!p) return p;
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+251" + p.slice(1);
  if (p.startsWith("251")) return "+" + p;
  return p;
}

function flattenValidationObj(obj: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) parts.push(...val.map(String));
    else if (typeof val === "string") parts.push(val);
  }
  return parts.length ? parts.join(" ") : null;
}

function stroErrMsg(stroRes: any, fallback: string): string {
  if (stroRes?.errors && typeof stroRes.errors === "object" && !Array.isArray(stroRes.errors)) {
    const flat = flattenValidationObj(stroRes.errors);
    if (flat) return flat;
  }
  const raw = stroRes?.message ?? stroRes?.error ?? stroRes?.errors?.[0];
  if (!raw) return fallback;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const nested = (raw as any).message ?? (raw as any).text ?? (raw as any).detail;
    if (typeof nested === "string") return nested;
    const flat = flattenValidationObj(raw as Record<string, unknown>);
    if (flat) return flat;
  }
  return String(raw);
}

async function getOrCreateWallet(userId: number) {
  let wallet = await db.query.walletsTable.findFirst({ where: eq(walletsTable.userId, userId) });
  if (!wallet) {
    [wallet] = await db
      .insert(walletsTable)
      .values({ userId, asset: "USDT", availableBalance: "0.00", frozenBalance: "0.00" })
      .returning();
  }
  return wallet!;
}

function formatDob(dob: string): string {
  const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return dob;
}

function mapIdType(idType: string): string {
  const map: Record<string, string> = {
    national_id: "national_id",
    passport: "passport",
    drivers_license: "drivers_license",
    kebele_id: "national_id",
  };
  return map[idType] ?? "national_id";
}

function pick(...vals: any[]): any {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return null;
}

// POST /api/cards/create
router.post("/create", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.kycStatus !== "verified") return res.status(403).json({ error: "KYC verification required" });

    const kyc = await db.query.kycSubmissionsTable.findFirst({ where: eq(kycSubmissionsTable.userId, userId) });
    if (!kyc || kyc.status !== "verified") return res.status(403).json({ error: "KYC verification required" });

    // Block duplicate queue entries — one pending creation per user maximum
    const existingQueue = await db.select()
      .from(cardQueueTable)
      .where(and(
        eq(cardQueueTable.userId, userId),
        eq(cardQueueTable.type, "create"),
        inArray(cardQueueTable.status, ["pending", "processing"])
      ))
      .limit(1);

    if (existingQueue.length > 0) {
      return res.status(400).json({
        success: true,
        queued: true,
        message: "Your card creation is already queued. Please wait — you will be notified when your card is ready. No additional charges will apply.",
      });
    }

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    const cardFeeSettings = await getCardSettings();
    const creationFee = parseFloat(cardFeeSettings.cardCreationFee);
    const initialLoad = Math.max(3, parseFloat(cardFeeSettings.cardInitialLoad));
    const totalRequired = creationFee + initialLoad;
    if (avail < totalRequired) {
      return res.status(400).json({ error: `Insufficient balance. You need at least $${totalRequired.toFixed(2)} USDT. You have $${avail.toFixed(2)} USDT.` });
    }

    // Fix 3 — validate phone BEFORE deducting balance
    const reqPhone = (req.body?.phone ?? user.phone ?? "").trim();
    if (!reqPhone) {
      return res.status(400).json({
        error: 'Phone number is required for card creation. Please add your phone number in your profile settings and try again.'
      });
    }
    console.log('[Card] Phone validated:', reqPhone);
    // Require a REAL, OTP-verified personal email for the card — never the
    // auto-generated placeholder. StroWallet sends purchase authorization
    // codes to this email, so it must genuinely belong to the cardholder.
    const cardEmail = String(req.body?.email ?? "").trim().toLowerCase();
    if (!cardEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardEmail)) {
      return res.status(400).json({ error: "A valid personal email is required for card creation." });
    }
    if (cardEmail.endsWith("@phone.xendrx.com")) {
      return res.status(400).json({ error: "Please use your real personal email, not a placeholder." });
    }
    const emailVerifiedRows = await db.select().from(verificationCodesTable).where(and(
      eq(verificationCodesTable.target, cardEmail),
      eq(verificationCodesTable.type, "card_email_otp"),
      eq(verificationCodesTable.used, true)
    )).orderBy(desc(verificationCodesTable.createdAt)).limit(1);
    const emailVerifiedRow = emailVerifiedRows[0];
    const emailVerifiedRecently = emailVerifiedRow && (Date.now() - new Date(emailVerifiedRow.createdAt).getTime() < 30 * 60 * 1000);
    if (!emailVerifiedRecently) {
      return res.status(400).json({ error: "Please verify your email with the code sent to it before creating a card." });
    }
    console.log("[Card] Email verified for card creation:", cardEmail);


    const nameParts = (kyc.fullName ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "N/A";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const fullName = kyc.fullName ?? `${firstName} ${lastName}`;
    const dob = formatDob(kyc.dateOfBirth ?? "01/01/1990");
    const idType = mapIdType(kyc.idType ?? "national_id");

    console.log("[Card] Step 1 — KYC check passed");
    console.log(`[Card]   user: ${userId}, name: ${fullName}, dob: ${dob}, idType: ${idType}`);

    const newBalance = (avail - creationFee).toFixed(6);
    await db.update(walletsTable).set({ availableBalance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));

    console.log(`[Card] Step 2 — Balance deducted ($${creationFee} fee). New balance:`, newBalance);
    console.log('[Card] Initial load amount:', initialLoad, '(minimum $3 enforced)');

    if (!process.env.STROWALLET_PUBLIC_KEY) {
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: "Card service not configured. Please contact support." });
    }

    // Fixed billing address used for all cards (StroWallet-registered US address)
    const FIXED_LINE1    = "3401 N. Miami, Ave. Ste 230";
    const FIXED_CITY     = "Miami";
    const FIXED_STATE    = "Florida";
    const FIXED_POSTAL   = "33127";
    const FIXED_COUNTRY  = "USA";

    const createUrl = stroBaseUrl("create-nfc-card");

    const body = {
      public_key: cleanKey(process.env.STROWALLET_PUBLIC_KEY),
      secret_key: cleanKey(process.env.STROWALLET_SECRET_KEY),
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      dob,
      id_type: idType,
      id_number: String(userId).padStart(11, "0"),
      id_image: kyc.frontImageUrl ? `${process.env.APP_URL ?? "https://xendrx.com"}${kyc.frontImageUrl}` : undefined,
      email: user.email,
      phone: normalizeEthPhoneForStro(user.phone ?? reqPhone) || "0900000000",
      line1: FIXED_LINE1,
      city: FIXED_CITY,
      state: FIXED_STATE,
      postal_code: FIXED_POSTAL,
      country: FIXED_COUNTRY,
      amount_usd: String(initialLoad),
      mode: "live",
    };

    console.log("[Card] Step 3 — Calling StroWallet API...");
    console.log("[Card] StroWallet URL:", createUrl.toString().replace(cleanKey(process.env.STROWALLET_PUBLIC_KEY), "***").replace(cleanKey(process.env.STROWALLET_SECRET_KEY), "***"));

    let stroRes: any;
    let stroOk = false;
    try {
      const response = await fetch(createUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.success === true || stroRes?.status === true || stroRes?.card_id);
      console.log("[Card] StroWallet response:", JSON.stringify(stroRes));
    } catch (fetchErr) {
      console.error("[Card] StroWallet fetch error:", fetchErr);
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: `Could not reach card service. Your $${creationFee.toFixed(2)} fee has been refunded.` });
    }

    if (!stroOk) {
      const rawMsg = stroMessageToString(stroRes?.message ?? stroRes?.error ?? '');
      const lc = rawMsg.toLowerCase();

      const isConfigError =
        (lc.includes("invalid") && (lc.includes("key") || lc.includes("public"))) ||
        lc.includes("unauthorized") ||
        lc.includes("authentication");

      const isLowBalance =
        !isConfigError && (
          lc.includes("insufficient") ||
          lc.includes("balance") ||
          stroRes?.required !== undefined ||
          stroRes?.available !== undefined
        );

      if (isLowBalance) {
        // Keep fee deducted — will be used when queue processes
        await enqueueCardCreate(userId, creationFee, `StroWallet: ${rawMsg}`);
        try {
          await PushNotify.adminAlert(
            `⚠️ StroWallet balance low — card creation queued for user ${userId}. Available: $${stroRes?.available ?? "unknown"}`
          );
        } catch {}
        return res.json({
          success: true,
          queued: true,
          message: "Your card creation request has been queued. You will be notified once your card is ready. No additional charges will apply.",
        });
      }

      // Refund fee for all non-queue errors
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      const errMsg = isConfigError
        ? "Card service is temporarily unavailable. Your fee has been refunded. Please try again later."
        : stroErrMsg(stroRes, "Card creation failed. Fee has been refunded.");
      console.error(`[Card] StroWallet rejected: ${errMsg}`);
      return res.status(422).json({ error: errMsg });
    }

    // Parse card_id from response — StroWallet nests under response.card_detail
    const d0 = stroRes?.response?.card_detail ?? stroRes?.response?.card ?? stroRes?.response ?? stroRes?.data ?? stroRes;
    const d1 = d0?.card ?? d0;

    const cardId: string = String(pick(d1?.card_id, d1?.cardId, d1?.id, d0?.card_id, d0?.id, stroRes?.card_id) ?? userId);
    const cardUserId: string | null = pick(d1?.card_user_id, d1?.user_id, d0?.card_user_id, d0?.user_id);
    const customerId: string | null = pick(d1?.customer_id, d0?.customer_id);
    const nameOnCard: string = pick(d1?.card_holder_name, d1?.name_on_card, d1?.name, d0?.card_holder_name, d0?.name_on_card, fullName.toUpperCase());
    let cardNumber: string | null = pick(d1?.card_number, d1?.pan, d0?.card_number);
    let last4: string | null = pick(d1?.last4, d0?.last4);
    let cvv: string | null = pick(d1?.cvv, d0?.cvv);
    let expiry: string | null = pick(d1?.expiry, d1?.expiry_date, d0?.expiry, d0?.expiry_date);
    let cardBalance: string = String(pick(d1?.balance, d0?.balance) ?? "3.00");
    const cardStatus: string = pick(d1?.card_status, d1?.status, d0?.card_status) ?? "active";

    if (!last4 && cardNumber) last4 = cardNumber.slice(-4);
    console.log(`[Card] Parsed → card_id:${cardId} last4:${last4} cvv:${cvv ? "***" : "null"} expiry:${expiry}`);

    // Always fetch full details after creation to populate PAN/CVV/expiry
    if (cardId !== String(userId)) {
      try {
        const detail = await fetchCardDetails(cardId);
        if (detail) {
          if (pick(detail.card_number, detail.pan)) cardNumber = pick(detail.card_number, detail.pan);
          if (pick(detail.last4)) last4 = detail.last4;
          if (pick(detail.cvv)) cvv = detail.cvv;
          if (pick(detail.expiry, detail.expiry_date)) expiry = pick(detail.expiry, detail.expiry_date);
          if (pick(detail.balance)) cardBalance = String(detail.balance);
          if (!last4 && cardNumber) last4 = cardNumber.slice(-4);
          console.log(`[Card] Detail enriched → last4:${last4} expiry:${expiry}`);
        }
      } catch (e) {
        console.warn("[Card] Post-creation detail fetch failed (non-fatal):", e);
      }
    }

    // Extract StroWallet detail fields
    const cardType: string | null = pick(d1?.card_type, d0?.card_type);
    const cardBrand: string | null = pick(d1?.card_brand, d0?.card_brand, "Visa");
    const reference: string | null = pick(d1?.reference, d0?.reference, stroRes?.reference);
    const cardCreatedDate: string | null = pick(d1?.card_created_date, d0?.card_created_date, new Date().toISOString());
    const customerEmailFromStro: string | null = user.email;

    // Fixed billing address for all cards
    const billingLine1 = FIXED_LINE1;
    const billingCity = FIXED_CITY;
    const billingState = FIXED_STATE;
    const billingPostal = FIXED_POSTAL;
    const billingCountry = FIXED_COUNTRY;

    console.log("[Card] Billing address:", billingLine1, billingCity, billingCountry);

    const billingPhone = reqPhone || user.phone || "";

    const [saved] = await db
      .insert(cardsTable)
      .values({
        userId, cardId, cardUserId, customerId, nameOnCard, cardStatus, cardNumber, last4, cvv, expiry, balance: cardBalance,
        cardType, cardBrand, reference, cardCreatedDate, customerEmail: customerEmailFromStro,
        billingLine1, billingCity, billingState, billingPostal, billingCountry, billingPhone,
      })
      .returning();

    // Only record the fee transaction AFTER both StroWallet confirmed AND card is saved to DB
    await db.insert(transactionsTable).values({ userId, type: "withdraw", amount: creationFee.toFixed(2), status: "completed", note: "Card creation fee" });
    console.log("[Card] Step — Fee transaction recorded after card saved successfully");

    return res.json({ card: saved, message: "Card created successfully" });
  } catch (err) {
    console.error("[Card] Create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/my-card
router.get("/my-card", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const card = await resolveUserCard(userId, req.query?.cardId as string | undefined);
    if (!card) {
      // Check for pending queue entry — show queued state instead of blank
      const pendingQueue = await db.select()
        .from(cardQueueTable)
        .where(and(
          eq(cardQueueTable.userId, userId),
          eq(cardQueueTable.type, "create"),
          inArray(cardQueueTable.status, ["pending", "processing"])
        ))
        .limit(1);

      if (pendingQueue.length > 0) {
        return res.json({
          card: null,
          queuedCreation: {
            status: pendingQueue[0].status,
            message: "Your card creation is queued. You will be notified when ready.",
            createdAt: pendingQueue[0].createdAt,
          },
        });
      }
      return res.json({ card: null });
    }

    console.log("[Card] Fetching card for user:", userId);
    console.log("[Card] Card from DB:", { cardId: card.cardId, status: card.cardStatus, last4: card.last4 });

    const cardIdIsReal = card.cardId && !/^\d+$/.test(card.cardId);
    // Terminated/inactive cards have no live data on StroWallet's side anymore —
    // re-syncing them would overwrite good stored data with zeroed/blank fields.
    const isDeadCard = card.cardStatus === "terminated" || card.cardStatus === "inactive";

    // Helper to attach billing object from DB fields
    const withBilling = (c: typeof card & Record<string, any>) => ({
      ...c,
      billing: {
        name: c.nameOnCard ?? "",
        line1: c.billingLine1 ?? "N/A",
        city: c.billingCity ?? "N/A",
        state: c.billingState ?? "N/A",
        postalCode: c.billingPostal ?? "00000",
        country: c.billingCountry ?? "ETH",
        phone: c.billingPhone ?? "",
      },
    });

    if (cardIdIsReal && process.env.STROWALLET_PUBLIC_KEY && !isDeadCard) {
      try {
        console.log("[Card] Fetching from StroWallet card_id:", card.cardId);
        const detail = await fetchCardDetails(card.cardId!);
        console.log("[Card] StroWallet response:", JSON.stringify(detail));

        if (detail) {
          const updates: Record<string, any> = {};
          const newStatus = pick(detail?.card_status, detail?.status);
          if (newStatus) updates.cardStatus = newStatus;
          const newBalance = pick(detail?.balance);
          if (newBalance) updates.balance = String(newBalance);
          const newPan = pick(detail?.card_number, detail?.pan);
          if (newPan) { updates.cardNumber = newPan; updates.last4 = newPan.slice(-4); }
          const newLast4 = pick(detail?.last4);
          if (newLast4 && !updates.last4) updates.last4 = newLast4;
          const newCvv = pick(detail?.cvv);
          if (newCvv) updates.cvv = newCvv;
          const newExpiry = pick(detail?.expiry, detail?.expiry_date);
          if (newExpiry) updates.expiry = newExpiry;
          // Enrich StroWallet detail fields
          const newCardType = pick(detail?.card_type);
          if (newCardType) updates.cardType = newCardType;
          const newCardBrand = pick(detail?.card_brand);
          if (newCardBrand) updates.cardBrand = newCardBrand;
          const newReference = pick(detail?.reference);
          if (newReference) updates.reference = newReference;
          const newCreatedDate = pick(detail?.card_created_date);
          if (newCreatedDate) updates.cardCreatedDate = newCreatedDate;
          // Sync billing address from StroWallet (covers address, billing_address, etc.)
          const newBillingLine1 = pick(detail?.billing_address, detail?.address, detail?.line1, detail?.street);
          if (newBillingLine1) updates.billingLine1 = newBillingLine1;
          const newBillingCity = pick(detail?.billing_city, detail?.city);
          if (newBillingCity) updates.billingCity = newBillingCity;
          const newBillingState = pick(detail?.billing_state, detail?.state);
          if (newBillingState) updates.billingState = newBillingState;
          const newBillingPostal = pick(detail?.billing_zip, detail?.billing_postal_code, detail?.postal_code, detail?.zip_code, detail?.zip);
          if (newBillingPostal) updates.billingPostal = newBillingPostal;
          const newBillingCountry = pick(detail?.billing_country, detail?.country);
          if (newBillingCountry) updates.billingCountry = newBillingCountry;
          console.log("[Card] Billing sync from StroWallet:", { newBillingLine1, newBillingCity, newBillingState, newBillingPostal, newBillingCountry });

          console.log("[Card] Details fetched for user:", userId, "card:", card.cardId);

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(cardsTable).set(updates).where(eq(cardsTable.userId, userId));
            return res.json({ card: withBilling({ ...card, ...updates }) });
          }
        }
      } catch (e) {
        console.warn("[Card] my-card detail fetch failed (returning cached):", e);
      }
    }

    return res.json({ card: withBilling(card as any) });
  } catch (err) {
    console.error("[Card] my-card error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/reveal — fetch fresh, short-lived secure iframe URLs for the
// card's PAN and CVV. These are NEVER stored server-side (PCI-DSS: CVV must
// never be persisted after authorization). The frontend embeds the returned
// URLs directly as iframes; the actual sensitive values are rendered by
// StroWallet's secure widget straight in the user's browser, never touching
// this backend or database.
router.get("/reveal", userAuth, async (req: any, res) => {
  const userId = req.userId;
  try {
    const card = await resolveUserCard(userId, req.query?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });
    if (card.cardStatus === "terminated" || card.cardStatus === "inactive") {
      return res.status(400).json({ error: "This card is no longer active." });
    }
    const detail = await fetchCardDetails(card.cardId!);
    if (!detail?.card_number_url || !detail?.cvv_url) {
      return res.status(502).json({ error: "Could not retrieve secure card details right now. Please try again shortly." });
    }
    return res.json({
      cardNumberUrl: detail.card_number_url,
      cvvUrl: detail.cvv_url,
    });
  } catch (err) {
    console.error("[Card] reveal error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/fund
router.post("/fund", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  const amount = parseFloat(req.body?.amount);
  const fundSettings = await getCardSettings();
  const minFund = parseFloat(fundSettings.cardMinFund);
  if (!amount || amount < minFund) return res.status(400).json({ error: `Minimum fund amount is $${minFund.toFixed(2)}` });

  try {
    // Block if there's already a pending fund queue entry for this user
    const existingQueue = await db.select()
      .from(cardQueueTable)
      .where(
        and(
          eq(cardQueueTable.userId, userId),
          eq(cardQueueTable.status, "pending"),
          eq(cardQueueTable.type, "fund")
        )
      );
    if (existingQueue.length > 0) {
      return res.status(429).json({ error: "You already have a pending card top-up. Please wait for it to complete before making another." });
    }

    // Block rapid re-submissions — 60s cooldown between successful fund attempts
    const recentFund = await db.select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          like(transactionsTable.note, "%Funded Xendrx card%"),
          gte(transactionsTable.createdAt, new Date(Date.now() - 60_000))
        )
      );
    if (recentFund.length > 0) {
      return res.status(429).json({ error: "Please wait 60 seconds between card top-ups." });
    }

    // Security checks
    const [velocity, balCheck, dailyCheck] = await Promise.all([
      checkVelocity(userId),
      checkBalance(userId, amount, "card-fund"),
      checkDailyLimit(userId, "withdraw", amount),
    ]);
    if (!velocity.allowed) return res.status(429).json({ error: velocity.reason });
    if (!balCheck.allowed) return res.status(400).json({ error: balCheck.reason });
    if (!dailyCheck.allowed) return res.status(400).json({ error: dailyCheck.reason });

    const card = await resolveUserCard(userId, req.body?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });

    const wallet = await getOrCreateWallet(userId);

    console.log("[Card] Fund check — user platform balance:", wallet.availableBalance);
    console.log("[Card] Fund amount requested:", amount);
    console.log("[Card] Balance sufficient:", Number(wallet.availableBalance) >= amount);

    const avail = Number(wallet.availableBalance);
    if (isNaN(avail)) {
      console.error("[Card] availableBalance is NaN — raw value:", wallet.availableBalance);
      return res.status(500).json({ error: "Could not read wallet balance. Please try again." });
    }

    if (avail < amount) {
      console.log(`[Card] Insufficient: avail=${avail}, requested=${amount}`);
      return res.status(400).json({ error: `Insufficient balance. Available: $${avail.toFixed(2)} USDT` });
    }

    // Atomically deduct from platform — prevents race conditions on concurrent top-up requests
    const debitResult = await db.execute(sql`
      UPDATE wallets
      SET available_balance = (available_balance::numeric - ${amount})::text,
          updated_at        = NOW()
      WHERE user_id = ${userId}
        AND available_balance::numeric >= ${amount}
      RETURNING id
    `);
    if (!debitResult.rows || debitResult.rows.length === 0) {
      return res.status(400).json({ error: `Insufficient balance. Available: $${avail.toFixed(2)} USDT` });
    }
    const newWalletBal = (avail - amount).toFixed(6);

    // Call StroWallet via query params (not body)
    const url = stroBaseUrl("fund-withdraw-nfccard");
    url.searchParams.set("card_id", card.cardId!);
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("type", "fund");

    let stroRes: any;
    try {
      const response = await fetch(url.toString(), { method: "POST" });
      stroRes = await response.json();
      console.log("[Card] StroWallet fund response:", JSON.stringify(stroRes));
    } catch (e) {
      // Refund on network error
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: "Could not reach card service. Balance refunded." });
    }

    if (!stroRes?.success) {
      const rawMsg = stroMessageToString(stroRes?.message ?? stroRes?.error ?? '');
      const lc = rawMsg.toLowerCase();
      console.log("[Card] StroWallet fund rejected:", rawMsg, "| full response:", JSON.stringify(stroRes));

      const isConfigError =
        (lc.includes("invalid") && (lc.includes("key") || lc.includes("public"))) ||
        lc.includes("unauthorized") ||
        lc.includes("authentication");

      const isLowBalance =
        !isConfigError && (
          lc.includes("insufficient") ||
          lc.includes("balance") ||
          stroRes?.required !== undefined ||
          stroRes?.available !== undefined
        );

      if (isLowBalance) {
        // Keep the balance deducted — queue will process it when merchant balance is topped up
        await enqueueCardFund(userId, card.cardId!, amount, `StroWallet: ${rawMsg}`);
        try {
          await PushNotify.adminAlert(
            `⚠️ StroWallet balance low — $${amount} top-up queued for user ${userId}. Available: $${stroRes?.available ?? "unknown"}, Required: $${stroRes?.required ?? "unknown"}`
          );
        } catch {}
        return res.json({
          success: true,
          queued: true,
          message: `Your top-up of $${amount.toFixed(2)} has been queued. Your balance has been reserved and will be credited to your card shortly. You'll get a push notification when it's done.`,
        });
      }

      // Refund for all non-queue errors
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      const userMsg = isConfigError
        ? "Card service is temporarily unavailable. Your balance has been refunded. Please try again later."
        : rawMsg || "Card top-up failed. Your balance has been refunded.";
      return res.status(503).json({ error: userMsg });
    }

    await db.insert(transactionsTable).values({ userId, type: "withdraw", amount: String(amount), status: "completed", note: "Funded Xendrx card" });
    auditLog(userId, "CARD_FUND", { amount, cardId: card.cardId, result: "success" }, req);

    // Re-fetch authoritative card balance
    let newCardBalance = (parseFloat(card.balance) + amount).toFixed(2);
    try {
      const fresh = await fetchCardDetails(card.cardId!);
      if (pick(fresh?.balance)) newCardBalance = parseFloat(String(fresh.balance)).toFixed(2);
    } catch {}
    await db.update(cardsTable).set({ balance: newCardBalance, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    console.log("[Card] Card balance after fund:", newCardBalance);
    console.log("[Card] Platform balance after:", newWalletBal);

    return res.json({
      message: "Card funded successfully",
      newCardBalance,
      newPlatformBalance: newWalletBal,
      reference: stroRes?.response?.reference ?? null,
    });
  } catch (err) {
    console.error("[Card] Fund error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/my-queue — user's own pending queue items
router.get("/my-queue", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const items = await db.select().from(cardQueueTable)
      .where(and(eq(cardQueueTable.userId, userId), eq(cardQueueTable.status, "pending")));
    res.json({ pending: items });
  } catch (err) {
    console.error("[Card] my-queue error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/withdraw
router.post("/withdraw", userAuth, async (_req: any, res) => {
  return res.status(403).json({ error: "Card withdrawal feature is not available." });

  // === DISABLED — kept for future re-enable ===
  const req = _req;
  const userId: number = req.userId;
  const amount = parseFloat(req.body?.amount);
  if (!amount || amount < 1) return res.status(400).json({ error: "Minimum withdraw amount is $1" });

  try {
    const card = await resolveUserCard(userId, req.body?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });

    console.log(`[Card] Withdraw — user: ${userId}, amount: ${amount}, card: ${card.cardId}`);

    // Call StroWallet FIRST — then touch platform balance only on success
    const url = stroBaseUrl("fund-withdraw-nfccard");
    url.searchParams.set("card_id", card.cardId!);
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("type", "withdraw");

    let stroRes: any;
    try {
      const response = await fetch(url.toString(), { method: "POST" });
      stroRes = await response.json();
      console.log("[Card] StroWallet withdraw response:", JSON.stringify(stroRes));
    } catch (e) {
      return res.status(503).json({ error: "Could not reach card service. Please try again." });
    }

    if (!stroRes?.success) {
      return res.status(503).json({ error: stroErrMsg(stroRes, "Card withdrawal failed. Please try again.") });
    }

    const wallet = await getOrCreateWallet(userId);
    const newWalletBal = (parseFloat(wallet.availableBalance) + amount).toFixed(6);
    await db.update(walletsTable).set({ availableBalance: newWalletBal, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));

    await db.insert(transactionsTable).values({ userId, type: "deposit", amount: String(amount), status: "completed", note: "Withdrawn from Xendrx card" });

    // Re-fetch authoritative card balance
    let newCardBalance = Math.max(0, parseFloat(card.balance) - amount).toFixed(2);
    try {
      const fresh = await fetchCardDetails(card.cardId!);
      if (pick(fresh?.balance)) newCardBalance = parseFloat(String(fresh.balance)).toFixed(2);
    } catch {}
    await db.update(cardsTable).set({ balance: newCardBalance, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    console.log("[Card] Card balance after withdraw:", newCardBalance);
    console.log("[Card] Platform balance after:", newWalletBal);

    return res.json({
      message: "Withdrawal successful",
      newCardBalance,
      newPlatformBalance: newWalletBal,
      reference: stroRes?.response?.reference ?? null,
    });
  } catch (err) {
    console.error("[Card] Withdraw error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/cards/billing — update billing address from our DB
router.patch("/billing", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const card = await resolveUserCard(userId, req.body?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });

    const { line1, city, state, postal_code, country, phone } = req.body ?? {};
    if (!line1 || !city || !postal_code || !phone) {
      return res.status(400).json({ error: "Street address, city, postal code, and phone are required" });
    }

    await db.update(cardsTable).set({
      billingLine1: String(line1).trim(),
      billingCity: String(city).trim(),
      billingState: String(state || city).trim(),
      billingPostal: String(postal_code).trim(),
      billingCountry: String(country || "ETH").trim(),
      billingPhone: String(phone).trim(),
      updatedAt: new Date(),
    }).where(eq(cardsTable.userId, userId));

    console.log("[Card] Billing updated for user:", userId, { line1, city, postal_code, country });
    return res.json({ success: true, message: "Billing address updated" });
  } catch (err) {
    console.error("[Card] Billing update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/freeze
router.post("/freeze", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  const { password } = req.body ?? {};

  try {
    // Verify platform password before allowing freeze/unfreeze
    if (!password) {
      return res.status(400).json({ error: "Password is required to freeze or unfreeze your card." });
    }
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user?.passwordHash) {
      return res.status(401).json({ error: "Unable to verify password. Please contact support." });
    }
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }
    console.log("[Card] Password verified for freeze — user:", userId);

    const card = await resolveUserCard(userId, req.body?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });

    const isFrozen = card.cardStatus === "inactive" || card.cardStatus === "frozen";
    const newStatus = isFrozen ? "active" : "frozen";

    console.log("[Card] Freeze — start");
    console.log("[Card] STROWALLET_PUBLIC_KEY set:", !!process.env.STROWALLET_PUBLIC_KEY);
    console.log("[Card] Key cleaned first 8:", cleanKey(process.env.STROWALLET_PUBLIC_KEY).substring(0, 8));
    console.log("[Card] card_id:", card.cardId);
    console.log("[Card] current status:", card.cardStatus);
    console.log("[Card] new status will be:", newStatus);

    const pk = cleanKey(process.env.STROWALLET_PUBLIC_KEY);

    // Method 1 — Query string
    try {
      const url = new URL(`${STRO_BASE}/nfc-cards/status`);
      url.searchParams.set("public_key", pk);
      url.searchParams.set("card_id", card.cardId!);
      url.searchParams.set("status", newStatus);
      url.searchParams.set("mode", "live");
      console.log("[Card] Method 1 URL:", url.toString().replace(pk, "***"));
      const r1 = await fetch(url.toString(), { method: "POST" });
      const t1 = await r1.text();
      console.log("[Card] Method 1 HTTP status:", r1.status);
      console.log("[Card] Method 1 raw response:", t1);
      const j1 = JSON.parse(t1);
      if (j1.success) {
        await db.update(cardsTable).set({ cardStatus: newStatus, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));
        return res.json({ message: newStatus === "frozen" ? "Card frozen successfully" : "Card activated successfully", cardStatus: newStatus });
      }
    } catch (e: any) {
      console.log("[Card] Method 1 failed:", e.message);
    }

    // Method 2 — Form-urlencoded body
    try {
      const formData = new URLSearchParams();
      formData.append("public_key", pk);
      formData.append("card_id", card.cardId!);
      formData.append("status", newStatus);
      formData.append("mode", "live");
      console.log("[Card] Method 2 form body:", formData.toString().replace(pk, "***"));
      const r2 = await fetch(`${STRO_BASE}/nfc-cards/status`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const t2 = await r2.text();
      console.log("[Card] Method 2 HTTP status:", r2.status);
      console.log("[Card] Method 2 raw response:", t2);
      const j2 = JSON.parse(t2);
      if (j2.success) {
        await db.update(cardsTable).set({ cardStatus: newStatus, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));
        return res.json({ message: newStatus === "frozen" ? "Card frozen successfully" : "Card activated successfully", cardStatus: newStatus });
      }
    } catch (e: any) {
      console.log("[Card] Method 2 failed:", e.message);
    }

    // Method 3 — JSON body
    try {
      const body = { public_key: pk, card_id: card.cardId, status: newStatus, mode: "live" };
      console.log("[Card] Method 3 JSON body:", JSON.stringify({ ...body, public_key: "***" }));
      const r3 = await fetch(`${STRO_BASE}/nfc-cards/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const t3 = await r3.text();
      console.log("[Card] Method 3 HTTP status:", r3.status);
      console.log("[Card] Method 3 raw response:", t3);
      const j3 = JSON.parse(t3);
      if (j3.success) {
        await db.update(cardsTable).set({ cardStatus: newStatus, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));
        return res.json({ message: newStatus === "frozen" ? "Card frozen successfully" : "Card activated successfully", cardStatus: newStatus });
      }
      const rawErr = j3?.message || j3?.error || "Card service rejected the request";
      console.log("[Card] All 3 methods failed for freeze — last error:", rawErr);
      const errMsg = rawErr.toLowerCase().includes("invalid") && rawErr.toLowerCase().includes("key")
        ? "Card service configuration error. Please contact support."
        : rawErr;
      return res.status(422).json({ error: errMsg });
    } catch (e: any) {
      console.log("[Card] Method 3 failed:", e.message);
    }

    console.log("[Card] All 3 methods failed for freeze");
    return res.status(503).json({ error: "Could not reach card service — check server logs for details" });
  } catch (err) {
    console.error("[Card] Freeze error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/terminate
router.post("/terminate", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  const { password } = req.body ?? {};

  try {
    if (!password) return res.status(400).json({ error: "Password is required to terminate your card." });

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user?.passwordHash) return res.status(401).json({ error: "Unable to verify password. Please contact support." });

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) return res.status(401).json({ error: "Incorrect password. Please try again." });

    const card = await resolveUserCard(userId, req.body?.cardId as string | undefined);
    if (!card) return res.status(404).json({ error: "No card found" });

    console.log("[Card] Terminate — user:", userId, "card:", card.cardId, "balance:", card.balance);

    const cardBalance = parseFloat(card.balance ?? "0");

    // Step 1: Freeze on StroWallet (soft terminate)
    if (card.cardId && !/^\d+$/.test(card.cardId) && process.env.STROWALLET_PUBLIC_KEY) {
      const pk = cleanKey(process.env.STROWALLET_PUBLIC_KEY);
      try {
        const url = new URL(`${STRO_BASE}/nfc-cards/status`);
        url.searchParams.set("public_key", pk);
        url.searchParams.set("card_id", card.cardId!);
        url.searchParams.set("status", "frozen");
        url.searchParams.set("mode", "live");
        const r = await fetch(url.toString(), { method: "POST" });
        const j = await r.json();
        console.log("[Card] Terminate freeze response:", JSON.stringify(j));
      } catch (e) {
        console.warn("[Card] Terminate freeze failed (non-fatal):", e);
      }

      // Step 2: Withdraw remaining balance from card back to platform
      if (cardBalance > 0) {
        try {
          const wurl = stroBaseUrl("fund-withdraw-nfccard");
          wurl.searchParams.set("card_id", card.cardId!);
          wurl.searchParams.set("amount", cardBalance.toString());
          wurl.searchParams.set("type", "withdraw");

          const wresp = await fetch(wurl.toString(), { method: "POST" });
          const wraw = await wresp.json();

          // Always log full raw response — essential for diagnosing shape mismatches
          console.log(`[Card] Terminate withdraw — HTTP ${wresp.status} — raw: ${JSON.stringify(wraw)}`);

          // StroWallet's success indicator isn't always a strict boolean.
          // Check every known variant: boolean true, numeric 1, status string.
          const isExplicitSuccess =
            wraw.success === true  ||
            wraw.success == true   ||   // catches numeric 1
            wraw.status === "success" ||
            wraw.status === true;

          // Explicit failure signals — StroWallet setting success: false or an error field
          const hasExplicitError =
            wraw.success === false ||
            (typeof wraw.error === "string" && wraw.error.length > 0);

          if (wresp.ok) {
            // HTTP 200 — credit the user regardless of the body's success field,
            // since we are terminating the card and they are entitled to the balance.
            // Flag ambiguous / explicit-failure cases for admin verification.
            const needsVerification = !isExplicitSuccess;
            const note = needsVerification
              ? `Card termination — balance returned [NEEDS_VERIFICATION: StroWallet response was ${hasExplicitError ? "explicit failure" : "ambiguous"} on HTTP 200 — verify against StroWallet dashboard. Raw: ${JSON.stringify(wraw)}]`
              : "Card termination — balance returned";

            const wallet = await getOrCreateWallet(userId);
            const newWalletBal = (parseFloat(wallet.availableBalance) + cardBalance).toFixed(6);
            await db.update(walletsTable)
              .set({ availableBalance: newWalletBal, updatedAt: new Date() })
              .where(eq(walletsTable.userId, userId));
            await db.insert(transactionsTable).values({
              userId,
              type: "deposit",
              amount: cardBalance.toFixed(2),
              status: "completed",
              note,
            });

            if (needsVerification) {
              console.warn(
                `[Card] Terminate — credited $${cardBalance.toFixed(2)} to user ${userId} but ` +
                `StroWallet response was ${hasExplicitError ? "an explicit failure" : "ambiguous"} ` +
                `(HTTP ${wresp.status}). Admin should verify against StroWallet dashboard. ` +
                `Raw: ${JSON.stringify(wraw)}`
              );
            } else {
              console.log(`[Card] Terminate — refunded $${cardBalance.toFixed(2)} to platform wallet`);
            }
          } else {
            // HTTP error (4xx/5xx) — StroWallet may not have processed the withdrawal at all;
            // do not credit silently. Log clearly so admin can investigate.
            console.warn(
              `[Card] Terminate balance withdraw failed — HTTP ${wresp.status}. ` +
              `$${cardBalance.toFixed(2)} NOT credited to user ${userId}. ` +
              `Raw: ${JSON.stringify(wraw)}`
            );
          }
        } catch (e) {
          console.warn("[Card] Terminate balance withdraw network error (non-fatal):", e);
        }
      }
    }

    // Step 3: Mark card as inactive in DB
    await db.update(cardsTable)
      .set({ cardStatus: "inactive", updatedAt: new Date() })
      .where(eq(cardsTable.userId, userId));

    console.log("[Card] Card terminated for user:", userId);

    return res.json({
      message: cardBalance > 0
        ? `Card terminated. $${cardBalance.toFixed(2)} returned to your wallet.`
        : "Card terminated successfully.",
      refundedAmount: cardBalance > 0 ? cardBalance.toFixed(2) : null,
    });
  } catch (err) {
    console.error("[Card] Terminate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/history
router.get("/history", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const card = await resolveUserCard(userId, req.query?.cardId as string | undefined);
    if (!card) return res.json({ transactions: [] });

    console.log(`[Card] History — card: ${card.cardId}`);

    let transactions: any[] = [];
    if (card.cardId && !/^\d+$/.test(card.cardId) && process.env.STROWALLET_PUBLIC_KEY) {
      try {
        const url = stroBaseUrl("nfc-card-transactions");
        url.searchParams.set("card_id", card.cardId);
        const loggableUrl = url.toString()
          .replace(cleanKey(process.env.STROWALLET_PUBLIC_KEY ?? ""), "***")
          .replace(cleanKey(process.env.STROWALLET_SECRET_KEY ?? ""), "***");
        console.log("[Card] History URL:", loggableUrl);

        const response = await fetch(url.toString());
        console.log("[Card] History HTTP status:", response.status);
        const raw = await response.json();
        console.log("[Card] History raw response:", JSON.stringify(raw));

        const txList =
          raw?.response?.card_transactions ??
          raw?.response?.transactions ??
          raw?.response?.data ??
          raw?.data ??
          (Array.isArray(raw?.response) ? raw.response : []) ??
          [];

        transactions = txList.map((tx: any) => ({
          id: tx.id,
          date: tx.createdAt ?? tx.created_at,
          description: tx.narrative ?? tx.narration ?? tx.description ?? "Transaction",
          amount: tx.amount,
          type: tx.type ?? (parseFloat(tx.amount ?? "0") >= 0 ? "debit" : "credit"),
          method: tx.method,
          status: tx.status,
          reference: tx.reference,
          currency: tx.currency ?? "USD",
        }));

        console.log(`[Card] Transactions found: ${transactions.length}`);
      } catch (e) {
        console.warn("[Card] History fetch failed:", e);
      }
    }

    return res.json({ transactions });
  } catch (err) {
    console.error("[Card] History error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { fetchCardDetails };
export default router;
