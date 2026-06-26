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

function stroUrl(path: string) {
  const key = process.env.STROWALLET_PUBLIC_KEY;
  const secret = process.env.STROWALLET_SECRET_KEY;
  let url = `${STRO_BASE}/${path}?public_key=${encodeURIComponent(key || "")}`;
  if (secret) url += `&secret_key=${encodeURIComponent(secret)}`;
  return url;
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

    if (!process.env.STROWALLET_PUBLIC_KEY) {
      // Refund the fee before returning the error
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(503).json({ error: "Card service not configured. Please contact support." });
    }

    console.log(`[Card] Creating card for user: ${userId} name: ${fullName}`);
    console.log(`[Card] KYC data retrieved: ${firstName}, ${lastName}, ${idType}`);
    console.log('[Card] Calling real StroWallet API with key:', process.env.STROWALLET_PUBLIC_KEY?.substring(0, 8));

    let stroRes: any;
    let stroOk = false;
    try {
      const body = {
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
        country: process.env.STROWALLET_COUNTRY ?? "US",
        amount_usd: "3",
        mode: "live",
      };

      const response = await fetch(stroUrl("create-nfc-card"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      stroRes = await response.json();
      stroOk = response.ok && (stroRes?.status === true || stroRes?.success === true || stroRes?.card_id);
      console.log(`[Card] StroWallet response: ${stroOk ? "success" : "failed"} — ${JSON.stringify(stroRes)?.slice(0, 300)}`);
    } catch (fetchErr) {
      console.error("[Card] StroWallet fetch error:", fetchErr);
      // Refund the fee on network error
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(502).json({ error: "Could not reach card service. Your balance has been refunded. Please try again." });
    }

    if (!stroOk) {
      const errMsg = stroErrMsg(stroRes, "Card creation failed. Please try again.");
      console.error(`[Card] StroWallet rejected card creation for user ${userId}: ${errMsg}`);
      // Refund the $2 fee — no card was created
      await db.update(walletsTable).set({ availableBalance: avail.toFixed(6), updatedAt: new Date() }).where(eq(walletsTable.userId, userId));
      return res.status(422).json({ error: errMsg });
    }

    const cardData = stroRes?.data ?? stroRes;
    const cardId: string = cardData?.card_id ?? cardData?.cardId ?? String(userId);
    const cardUserId: string | null = cardData?.user_id ?? cardData?.userId ?? null;
    const customerId: string | null = cardData?.customer_id ?? cardData?.customerId ?? null;
    const nameOnCard: string = cardData?.name_on_card ?? fullName.toUpperCase();
    const cardNumber: string | null = cardData?.card_number ?? null;
    const last4: string | null = cardData?.last4 ?? (cardNumber ? cardNumber.slice(-4) : null);
    const cvv: string | null = cardData?.cvv ?? null;
    const expiry: string | null = cardData?.expiry ?? null;
    const cardBalance: string = String(cardData?.balance ?? "3.00");
    const cardStatus: string = cardData?.card_status ?? "active";

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

    if (card.cardId && process.env.STROWALLET_PUBLIC_KEY) {
      try {
        const response = await fetch(
          stroUrl("fetch-nfccard-detail") + `&card_id=${encodeURIComponent(card.cardId)}`
        );
        if (response.ok) {
          const data = await response.json();
          const d = data?.data ?? data;
          const updates: Partial<typeof card> = {};
          if (d?.card_status) updates.cardStatus = d.card_status;
          if (d?.balance !== undefined) updates.balance = String(d.balance);
          if (d?.card_number) updates.cardNumber = d.card_number;
          if (d?.last4) updates.last4 = d.last4;
          if (d?.cvv) updates.cvv = d.cvv;
          if (d?.expiry) updates.expiry = d.expiry;
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db
              .update(cardsTable)
              .set(updates as any)
              .where(eq(cardsTable.userId, userId));
            return res.json({ card: { ...card, ...updates } });
          }
        }
      } catch {
        // fall through to return cached card
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

    let stroOk = false;
    let stroRes: any;
    try {
      const response = await fetch(stroUrl("fund-withdraw-nfccard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.cardId, amount: String(amount), type: "fund" }),
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
        body: JSON.stringify({ card_id: card.cardId, amount: String(amount), type: "withdraw" }),
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
        body: JSON.stringify({ card_id: card.cardId, action }),
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
