import { Router } from "express";
import { db } from "@workspace/db";
import {
  cardsTable,
  kycSubmissionsTable,
  usersTable,
  walletsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userAuth } from "../middleware/user-auth";

const router = Router();

const STRO_BASE = "https://strowallet.com/api/bitvcard";

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

    const existing = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (existing) return res.status(400).json({ error: "You already have a card" });

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    const cardFeeSettings = await getCardSettings();
    const creationFee = parseFloat(cardFeeSettings.cardCreationFee);
    const initialLoad = parseFloat(cardFeeSettings.cardInitialLoad);
    const totalRequired = creationFee + initialLoad;
    if (avail < totalRequired) {
      return res.status(400).json({ error: `Insufficient balance. You need at least $${totalRequired.toFixed(2)} USDT. You have $${avail.toFixed(2)} USDT.` });
    }

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

    if (!process.env.STROWALLET_PUBLIC_KEY) {
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: "Card service not configured. Please contact support." });
    }

    const country = (req.body?.country ?? process.env.STROWALLET_COUNTRY ?? "ETH").replace(/\s+/g, "");
    const createUrl = stroBaseUrl("create-nfc-card");

    const body = {
      public_key: cleanKey(process.env.STROWALLET_PUBLIC_KEY),
      secret_key: cleanKey(process.env.STROWALLET_SECRET_KEY),
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      dob,
      id_type: idType,
      id_number: `ETH${String(userId).padStart(8, "0")}`,
      email: user.email,
      phone: user.phone ?? "0900000000",
      line1: "N/A",
      city: "N/A",
      state: "N/A",
      postal_code: "00000",
      country,
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
      return res.status(502).json({ error: `Could not reach card service. Your $${creationFee.toFixed(2)} fee has been refunded.` });
    }

    if (!stroOk) {
      const errMsg = stroErrMsg(stroRes, "Card creation failed. Please try again.");
      console.error(`[Card] StroWallet rejected: ${errMsg}`);
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
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

    const [saved] = await db
      .insert(cardsTable)
      .values({ userId, cardId, cardUserId, customerId, nameOnCard, cardStatus, cardNumber, last4, cvv, expiry, balance: cardBalance })
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
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.json({ card: null });

    console.log("[Card] Fetching card for user:", userId);
    console.log("[Card] Card from DB:", { cardId: card.cardId, status: card.cardStatus, last4: card.last4 });

    const cardIdIsReal = card.cardId && !/^\d+$/.test(card.cardId);

    if (cardIdIsReal && process.env.STROWALLET_PUBLIC_KEY) {
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

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(cardsTable).set(updates).where(eq(cardsTable.userId, userId));
            return res.json({ card: { ...card, ...updates } });
          }
        }
      } catch (e) {
        console.warn("[Card] my-card detail fetch failed (returning cached):", e);
      }
    }

    return res.json({ card });
  } catch (err) {
    console.error("[Card] my-card error:", err);
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
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.status(404).json({ error: "No card found" });

    const wallet = await getOrCreateWallet(userId);

    console.log("[Card] Fund request — user:", userId, "amount:", amount);
    console.log("[Card] Wallet from DB:", JSON.stringify(wallet));
    console.log("[Card] Wallet availableBalance:", wallet.availableBalance, "type:", typeof wallet.availableBalance);
    console.log("[Card] Amount requested:", amount, "type:", typeof amount);
    console.log("[Card] Balance check (wallet >= amount):", Number(wallet.availableBalance) >= Number(amount));

    const avail = Number(wallet.availableBalance);
    if (isNaN(avail)) {
      console.error("[Card] availableBalance is NaN — raw value:", wallet.availableBalance);
      return res.status(500).json({ error: "Could not read wallet balance. Please try again." });
    }

    if (avail < amount) {
      console.log(`[Card] Insufficient: avail=${avail}, requested=${amount}`);
      return res.status(400).json({ error: `Insufficient balance. Available: $${avail.toFixed(2)} USDT` });
    }

    // Deduct from platform first
    const newWalletBal = (avail - amount).toFixed(6);
    await db.update(walletsTable).set({ availableBalance: newWalletBal, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));

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
      return res.status(502).json({ error: "Could not reach card service. Balance refunded." });
    }

    if (!stroRes?.success) {
      // Refund
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(502).json({ error: stroErrMsg(stroRes, "Card funding failed. Amount refunded.") });
    }

    await db.insert(transactionsTable).values({ userId, type: "withdraw", amount: String(amount), status: "completed", note: "Funded Xendrx card" });

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

// POST /api/cards/withdraw
router.post("/withdraw", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  const amount = parseFloat(req.body?.amount);
  if (!amount || amount < 1) return res.status(400).json({ error: "Minimum withdraw amount is $1" });

  try {
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
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
      return res.status(502).json({ error: "Could not reach card service. Please try again." });
    }

    if (!stroRes?.success) {
      return res.status(502).json({ error: stroErrMsg(stroRes, "Card withdrawal failed. Please try again.") });
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

    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.status(404).json({ error: "No card found" });

    const isFrozen = card.cardStatus === "inactive" || card.cardStatus === "frozen";
    const newStatus = isFrozen ? "active" : "frozen";

    console.log("[Card] Freeze request — user:", userId, "card:", card.cardId);
    console.log("[Card] Current status:", card.cardStatus, "→ new status:", newStatus);
    console.log("[Card] STROWALLET_PUBLIC_KEY loaded:", !!process.env.STROWALLET_PUBLIC_KEY);
    console.log("[Card] Key first 8 chars:", cleanKey(process.env.STROWALLET_PUBLIC_KEY).substring(0, 8));
    console.log("[Card] card_id:", card.cardId);
    console.log("[Card] new status:", newStatus);

    let stroRes: any;
    let httpStatus: number;
    try {
      // Try 1 — form-urlencoded body (API rejects public_key in query string)
      const formData = new URLSearchParams();
      formData.append("public_key", cleanKey(process.env.STROWALLET_PUBLIC_KEY));
      formData.append("secret_key", cleanKey(process.env.STROWALLET_SECRET_KEY));
      formData.append("card_id", card.cardId!);
      formData.append("status", newStatus);
      formData.append("mode", "live");

      console.log("[Card] Trying form-urlencoded body...");
      let response = await fetch(`${STRO_BASE}/nfc-cards/status`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      httpStatus = response.status;
      stroRes = await response.json();
      console.log("[Card] Freeze HTTP status:", httpStatus);
      console.log("[Card] Freeze response:", JSON.stringify(stroRes));

      // Try 2 — JSON body if form-urlencoded also returns a key error
      const keyError = !stroRes?.success &&
        (stroRes?.message ?? stroRes?.error ?? "").toLowerCase().includes("public_key");
      if (keyError) {
        console.log("[Card] Form body failed with key error — retrying as JSON body...");
        response = await fetch(`${STRO_BASE}/nfc-cards/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_key: cleanKey(process.env.STROWALLET_PUBLIC_KEY),
            secret_key: cleanKey(process.env.STROWALLET_SECRET_KEY),
            card_id: card.cardId,
            status: newStatus,
            mode: "live",
          }),
        });
        httpStatus = response.status;
        stroRes = await response.json();
        console.log("[Card] Freeze JSON HTTP status:", httpStatus);
        console.log("[Card] Freeze JSON response:", JSON.stringify(stroRes));
      }
    } catch (e) {
      console.error("[Card] Freeze fetch error:", e);
      return res.status(502).json({ error: "Could not reach card service. Please try again." });
    }

    if (!stroRes?.success) {
      const errMsg = stroRes?.message || `Failed to update card status`;
      console.error("[Card] Freeze rejected by StroWallet:", errMsg);
      return res.status(422).json({ error: errMsg });
    }

    await db.update(cardsTable).set({ cardStatus: newStatus, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    console.log("[Card] Card status updated to:", newStatus, "for user:", userId);
    return res.json({ message: newStatus === "frozen" ? "Card frozen successfully" : "Card activated successfully", cardStatus: newStatus });
  } catch (err) {
    console.error("[Card] Freeze error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/history
router.get("/history", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.json({ transactions: [] });

    console.log(`[Card] History — card: ${card.cardId}`);

    let transactions: any[] = [];
    if (card.cardId && !/^\d+$/.test(card.cardId) && process.env.STROWALLET_PUBLIC_KEY) {
      try {
        const url = stroBaseUrl("nfc-card-transactions");
        url.searchParams.set("card_id", card.cardId);
        const response = await fetch(url.toString());
        const raw = await response.json();
        console.log("[Card] History raw response:", JSON.stringify(raw));

        const txList = raw?.response?.card_transactions ?? raw?.response?.transactions ?? raw?.data ?? [];
        transactions = txList.map((tx: any) => ({
          id: tx.id,
          date: tx.createdAt ?? tx.created_at,
          description: tx.narrative ?? tx.narration ?? tx.description ?? "Transaction",
          amount: tx.amount,
          type: tx.type,
          method: tx.method,
          status: tx.status,
          reference: tx.reference,
          currency: tx.currency ?? "USD",
        }));

        console.log(`[Card] History — found: ${transactions.length} transactions`);
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
