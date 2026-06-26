import { Router } from "express";
import { db } from "@workspace/db";
import {
  cardsTable,
  kycSubmissionsTable,
  usersTable,
  walletsTable,
  transactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { userAuth } from "../middleware/user-auth";

const router = Router();

const STRO_BASE = "https://strowallet.com/api/bitvcard";

// Strip all whitespace (spaces, newlines, etc.) from a key value
function cleanKey(k: string | undefined): string {
  return (k || "").replace(/\s+/g, "");
}

// GET requests: keys go in query string
function stroUrl(path: string) {
  const key = cleanKey(process.env.STROWALLET_PUBLIC_KEY);
  const secret = cleanKey(process.env.STROWALLET_SECRET_KEY);
  let url = `${STRO_BASE}/${path}?public_key=${encodeURIComponent(key)}`;
  if (secret) url += `&secret_key=${encodeURIComponent(secret)}`;
  return url;
}

// POST requests: keys go in the request body
function stroKeys() {
  return {
    public_key: cleanKey(process.env.STROWALLET_PUBLIC_KEY),
    secret_key: cleanKey(process.env.STROWALLET_SECRET_KEY),
  };
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
  // Case 1: { errors: { field: ["msg"], ... } }
  if (stroRes?.errors && typeof stroRes.errors === "object" && !Array.isArray(stroRes.errors)) {
    const flat = flattenValidationObj(stroRes.errors);
    if (flat) return flat;
  }
  const raw = stroRes?.message ?? stroRes?.error ?? stroRes?.errors?.[0];
  if (!raw) return fallback;
  if (typeof raw === "string") return raw;
  // Case 2: message is itself a validation object { field: ["msg"], ... }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const nested = (raw as any).message ?? (raw as any).text ?? (raw as any).detail;
    if (typeof nested === "string") return nested;
    const flat = flattenValidationObj(raw as Record<string, unknown>);
    if (flat) return flat;
  }
  return String(raw);
}

async function getOrCreateWallet(userId: number) {
  let wallet = await db.query.walletsTable.findFirst({
    where: eq(walletsTable.userId, userId),
  });
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

// POST /api/cards/create
router.post("/create", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.kycStatus !== "verified") {
      return res.status(403).json({ error: "KYC verification required" });
    }

    const kyc = await db.query.kycSubmissionsTable.findFirst({
      where: eq(kycSubmissionsTable.userId, userId),
    });
    if (!kyc || kyc.status !== "verified") {
      return res.status(403).json({ error: "KYC verification required" });
    }

    const existing = await db.query.cardsTable.findFirst({
      where: eq(cardsTable.userId, userId),
    });
    if (existing) return res.status(400).json({ error: "You already have a card" });

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    if (avail < 5) {
      return res.status(400).json({
        error: `Insufficient balance. You need at least $5.00 USDT. You have $${avail.toFixed(2)} USDT.`,
      });
    }

    const nameParts = (kyc.fullName ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "N/A";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const fullName = kyc.fullName ?? `${firstName} ${lastName}`;
    const dob = formatDob(kyc.dateOfBirth ?? "01/01/1990");
    const idType = mapIdType(kyc.idType ?? "national_id");

    console.log('[Card] Step 1 — KYC check passed');
    console.log(`[Card]   user: ${userId}, name: ${fullName}, dob: ${formatDob(kyc.dateOfBirth ?? "01/01/1990")}, idType: ${mapIdType(kyc.idType ?? "national_id")}`);

    const newBalance = (avail - 2).toFixed(6);
    await db
      .update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));

    await db.insert(transactionsTable).values({
      userId,
      type: "withdraw",
      amount: "2.00",
      status: "completed",
      note: "Card creation fee",
    });

    console.log('[Card] Step 2 — Balance deducted ($2 fee). New balance:', newBalance);

    if (!process.env.STROWALLET_PUBLIC_KEY) {
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: "Card service not configured. Please contact support." });
    }

    const stroEndpoint = stroUrl("create-nfc-card");
    const body = {
      ...stroKeys(),
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
      country: (req.body?.country ?? process.env.STROWALLET_COUNTRY ?? "ETH").replace(/\s+/g, ""),
      amount_usd: "3",
      mode: "live",
    };

    console.log('[Card] Step 3 — Calling StroWallet API...');
    console.log('[Card] StroWallet URL:', stroEndpoint);
    console.log('[Card] StroWallet params:', {
      ...body,
      public_key: body.public_key ? body.public_key.substring(0, 8) + '…' : '(missing)',
      secret_key: body.secret_key ? '***' : '(missing)',
    });

    let stroRes: any;
    let stroOk = false;
    try {
      const response = await fetch(stroEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.status === true || stroRes?.success === true || stroRes?.card_id);
      console.log('[Card] StroWallet response:', JSON.stringify(stroRes));
    } catch (fetchErr) {
      console.error("[Card] StroWallet fetch error:", fetchErr);
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(502).json({ error: "Could not reach card service. Your balance has been refunded. Please try again." });
    }

    if (!stroOk) {
      const errMsg = stroErrMsg(stroRes, "Card creation failed. Please try again.");
      console.error(`[Card] StroWallet rejected card creation for user ${userId}: ${errMsg}`);
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(422).json({ error: errMsg });
    }

    // StroWallet may nest data under .data, .card, or at the root level — try all paths
    const d0 = stroRes?.data ?? stroRes?.card ?? stroRes;
    const d1 = d0?.card ?? d0; // some responses nest further under .card

    function pick(...vals: any[]): any {
      for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
      return null;
    }

    const cardId: string = String(
      pick(d1?.card_id, d1?.cardId, d1?.id, d0?.card_id, d0?.cardId, d0?.id, stroRes?.card_id)
      ?? userId
    );
    const cardUserId: string | null = pick(d1?.user_id, d1?.userId, d0?.user_id, d0?.userId);
    const customerId: string | null = pick(d1?.customer_id, d1?.customerId, d0?.customer_id, d0?.customerId);
    const nameOnCard: string = pick(d1?.name_on_card, d1?.name, d0?.name_on_card, d0?.name, fullName.toUpperCase());
    let cardNumber: string | null = pick(d1?.card_number, d1?.pan, d0?.card_number, d0?.pan);
    let last4: string | null = pick(d1?.last4, d1?.last_four, d0?.last4, d0?.last_four);
    let cvv: string | null = pick(d1?.cvv, d1?.cvv2, d0?.cvv, d0?.cvv2);
    let expiry: string | null = pick(d1?.expiry, d1?.expiry_date, d1?.expiration, d0?.expiry, d0?.expiry_date, d0?.expiration);
    let cardBalance: string = String(pick(d1?.balance, d0?.balance) ?? "3.00");
    const cardStatus: string = pick(d1?.card_status, d1?.status, d0?.card_status, d0?.status) ?? "active";

    if (!last4 && cardNumber) last4 = cardNumber.slice(-4);

    console.log(`[Card] Parsed → card_id:${cardId} last4:${last4} cvv:${cvv ? "***" : "null"} expiry:${expiry} balance:${cardBalance}`);

    // Warn if card_id looks like a fallback (just the userId)
    if (cardId === String(userId)) {
      console.warn(`[Card] WARNING: card_id fell back to userId=${userId}. Full response:`, JSON.stringify(stroRes));
    }

    // Always attempt to fetch full card details from StroWallet after creation
    if (cardId !== String(userId)) {
      try {
        const detailUrl = stroUrl("fetch-nfccard-detail") + `&card_id=${encodeURIComponent(cardId)}`;
        console.log(`[Card] Fetching card detail from: ${detailUrl}`);
        const detailRes = await fetch(detailUrl);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          console.log('[Card] Detail response:', JSON.stringify(detail));
          const dd = detail?.data?.card ?? detail?.data ?? detail?.card ?? detail;
          if (dd) {
            if (pick(dd.card_number, dd.pan)) cardNumber = pick(dd.card_number, dd.pan);
            if (pick(dd.last4, dd.last_four)) last4 = pick(dd.last4, dd.last_four);
            if (pick(dd.cvv, dd.cvv2)) cvv = pick(dd.cvv, dd.cvv2);
            if (pick(dd.expiry, dd.expiry_date, dd.expiration)) expiry = pick(dd.expiry, dd.expiry_date, dd.expiration);
            if (pick(dd.balance)) cardBalance = String(dd.balance);
            if (!last4 && cardNumber) last4 = cardNumber.slice(-4);
            console.log(`[Card] Detail enriched → last4:${last4} cvv:${cvv ? "***" : "null"} expiry:${expiry}`);
          }
        }
      } catch (detailErr) {
        console.warn('[Card] Detail fetch failed (non-fatal):', detailErr);
      }
    }

    const [saved] = await db
      .insert(cardsTable)
      .values({
        userId,
        cardId,
        cardUserId,
        customerId,
        nameOnCard,
        cardStatus,
        cardNumber,
        last4,
        cvv,
        expiry,
        balance: cardBalance,
      })
      .returning();

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
    const card = await db.query.cardsTable.findFirst({
      where: eq(cardsTable.userId, userId),
    });
    if (!card) return res.json({ card: null });

    // Only fetch from StroWallet if card_id looks real (not a plain number fallback)
    const cardIdIsReal = card.cardId && !/^\d+$/.test(card.cardId);

    if (cardIdIsReal && process.env.STROWALLET_PUBLIC_KEY) {
      try {
        const detailUrl = stroUrl("fetch-nfccard-detail") + `&card_id=${encodeURIComponent(card.cardId!)}`;
        console.log(`[Card] my-card fetching detail: ${detailUrl}`);
        const response = await fetch(detailUrl);
        const raw = await response.json();
        console.log('[Card] my-card StroWallet detail response:', JSON.stringify(raw));

        if (response.ok) {
          // Try all possible nesting shapes
          const dd = raw?.data?.card ?? raw?.data ?? raw?.card ?? raw;

          function pickStr(...vals: any[]): string | null {
            for (const v of vals) if (v !== undefined && v !== null && v !== "") return String(v);
            return null;
          }

          const updates: Record<string, any> = {};
          const newStatus = pickStr(dd?.card_status, dd?.status);
          if (newStatus) updates.cardStatus = newStatus;
          const newBalance = pickStr(dd?.balance);
          if (newBalance) updates.balance = newBalance;
          const newPan = pickStr(dd?.card_number, dd?.pan);
          if (newPan) { updates.cardNumber = newPan; updates.last4 = newPan.slice(-4); }
          const newLast4 = pickStr(dd?.last4, dd?.last_four);
          if (newLast4 && !updates.last4) updates.last4 = newLast4;
          const newCvv = pickStr(dd?.cvv, dd?.cvv2);
          if (newCvv) updates.cvv = newCvv;
          const newExpiry = pickStr(dd?.expiry, dd?.expiry_date, dd?.expiration);
          if (newExpiry) updates.expiry = newExpiry;

          console.log('[Card] my-card updates to apply:', { ...updates, cvv: updates.cvv ? '***' : undefined });

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(cardsTable).set(updates).where(eq(cardsTable.userId, userId));
            return res.json({ card: { ...card, ...updates } });
          }
        }
      } catch (detailErr) {
        console.warn('[Card] my-card detail fetch failed (returning cached):', detailErr);
      }
    } else if (!cardIdIsReal) {
      console.warn(`[Card] my-card: card_id "${card.cardId}" looks like a fallback — skipping StroWallet fetch`);
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
  if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.status(404).json({ error: "No card found" });

    const wallet = await getOrCreateWallet(userId);
    const avail = parseFloat(wallet.availableBalance);
    if (avail < amount) {
      return res.status(400).json({
        error: `Insufficient balance. Available: $${avail.toFixed(2)} USDT`,
      });
    }

    const newBalance = (avail - amount).toFixed(6);
    await db
      .update(walletsTable)
      .set({ availableBalance: newBalance, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));

    console.log(`[Card] Funding card ${card.cardId} amount: ${amount} USDT`);
    console.log('[Card] Fund request params:', {
      public_key: process.env.STROWALLET_PUBLIC_KEY?.substring(0, 8),
      card_id: card.cardId,
      amount,
      type: 'fund',
    });

    let stroOk = false;
    let stroRes: any;
    try {
      const response = await fetch(stroUrl("fund-withdraw-nfccard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stroKeys(), card_id: card.cardId, amount: String(amount), type: "fund" }),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.status === true || stroRes?.success === true);
    } catch {}

    if (!stroOk) {
      const refund = (parseFloat(newBalance) + amount).toFixed(6);
      await db.update(walletsTable).set({ availableBalance: refund, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(502).json({ error: stroErrMsg(stroRes, "Funding failed. Amount has been refunded.") });
    }

    await db.insert(transactionsTable).values({
      userId,
      type: "withdraw",
      amount: String(amount),
      status: "completed",
      note: `Funded Xendrx card`,
    });

    const newCardBalance = (parseFloat(card.balance) + amount).toFixed(2);
    await db.update(cardsTable).set({ balance: newCardBalance, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    return res.json({ message: "Card funded successfully", balance: newCardBalance });
  } catch (err) {
    console.error("[Card] Fund error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/withdraw
router.post("/withdraw", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  const amount = parseFloat(req.body?.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  try {
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.status(404).json({ error: "No card found" });

    console.log(`[Card] Withdraw from card ${card.cardId} amount: ${amount} USDT`);

    let stroOk = false;
    let stroRes: any;
    try {
      const response = await fetch(stroUrl("fund-withdraw-nfccard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stroKeys(), card_id: card.cardId, amount: String(amount), type: "withdraw" }),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.status === true || stroRes?.success === true);
    } catch {}

    if (!stroOk) {
      return res.status(502).json({ error: stroErrMsg(stroRes, "Withdrawal failed. Please try again.") });
    }

    const wallet = await getOrCreateWallet(userId);
    const newWalletBalance = (parseFloat(wallet.availableBalance) + amount).toFixed(6);
    await db.update(walletsTable).set({ availableBalance: newWalletBalance, updatedAt: new Date() }).where(eq(walletsTable.userId, userId));

    await db.insert(transactionsTable).values({
      userId,
      type: "deposit",
      amount: String(amount),
      status: "completed",
      note: "Withdrawn from Xendrx card",
    });

    const newCardBalance = Math.max(0, parseFloat(card.balance) - amount).toFixed(2);
    await db.update(cardsTable).set({ balance: newCardBalance, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    return res.json({ message: "Withdrawal successful", walletBalance: newWalletBalance });
  } catch (err) {
    console.error("[Card] Withdraw error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cards/freeze
router.post("/freeze", userAuth, async (req: any, res) => {
  const userId: number = req.userId;
  try {
    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.userId, userId) });
    if (!card) return res.status(404).json({ error: "No card found" });

    const isFrozen = card.cardStatus === "inactive" || card.cardStatus === "frozen";
    const action = isFrozen ? "unfreeze" : "freeze";
    console.log(`[Card] ${action} card ${card.cardId}`);

    let stroOk = false;
    let stroRes: any;
    try {
      const response = await fetch(stroUrl("freeze-unfreeze-nfccard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stroKeys(), card_id: card.cardId, action }),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.status === true || stroRes?.success === true);
    } catch {}

    if (!stroOk) {
      return res.status(502).json({ error: stroErrMsg(stroRes, `Card ${action} failed. Please try again.`) });
    }

    const newStatus = isFrozen ? "active" : "inactive";
    await db.update(cardsTable).set({ cardStatus: newStatus, updatedAt: new Date() }).where(eq(cardsTable.userId, userId));

    return res.json({ message: `Card ${action}d successfully`, cardStatus: newStatus });
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

    let transactions: any[] = [];
    if (card.cardId && process.env.STROWALLET_PUBLIC_KEY) {
      try {
        const response = await fetch(
          stroUrl("nfc-card-history") + `&card_id=${encodeURIComponent(card.cardId)}`
        );
        if (response.ok) {
          const data = await response.json();
          transactions = data?.data ?? data?.transactions ?? [];
        }
      } catch {}
    }

    return res.json({ transactions });
  } catch (err) {
    console.error("[Card] History error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cards/admin/all — admin only (checked via admin JWT separately in admin.ts)
export default router;
