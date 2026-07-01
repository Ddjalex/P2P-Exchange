import { db } from "@workspace/db";
import { cardQueueTable, cardsTable, walletsTable, transactionsTable, kycSubmissionsTable, usersTable, systemSettingsTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { PushNotify } from "../routes/push.js";

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

async function stroFetchCardDetail(cardId: string): Promise<any | null> {
  try {
    const pub = process.env.STROWALLET_PUBLIC_KEY;
    if (!pub) return null;
    const url = new URL("https://strowallet.com/api/bitvcard/fetch-nfccard-detail");
    url.searchParams.set("public_key", pub);
    url.searchParams.set("card_id", cardId);
    const res = await fetch(url.toString());
    const raw = await res.json();
    return raw?.response?.card_detail ?? raw?.response?.card ?? raw?.response ?? null;
  } catch {
    return null;
  }
}

async function getInitialLoad(): Promise<number> {
  try {
    const rows = await db.select().from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "cardInitialLoad"));
    return Math.max(3, parseFloat(rows[0]?.value ?? "3"));
  } catch {
    return 3;
  }
}

const STRO_BASE = "https://strowallet.com/api/bitvcard";

function cleanKey(k: string) { return k.replace(/\s+/g, ""); }
function stroUrl(path: string): URL {
  const url = new URL(`${STRO_BASE}/${path}`);
  url.searchParams.set("public_key", cleanKey(process.env.STROWALLET_PUBLIC_KEY ?? ""));
  url.searchParams.set("secret_key", cleanKey(process.env.STROWALLET_SECRET_KEY ?? ""));
  url.searchParams.set("mode", "live");
  return url;
}

async function getMerchantBalance(): Promise<number> {
  try {
    const url = new URL("https://strowallet.com/api/wallet/balance/USD/");
    url.searchParams.set("public_key", cleanKey(process.env.STROWALLET_PUBLIC_KEY ?? ""));
    const res = await fetch(url.toString());
    const data = await res.json();
    return parseFloat(data?.balance ?? data?.data?.balance ?? "0") || 0;
  } catch {
    return 0;
  }
}

export async function enqueueCardFund(userId: number, cardId: string, amount: number, errorMsg: string) {
  await db.insert(cardQueueTable).values({
    userId,
    cardId,
    type: "fund",
    amount: amount.toFixed(2),
    status: "pending",
    errorMessage: errorMsg,
  });
  console.log(`[Queue] Enqueued fund: userId=${userId} cardId=${cardId} amount=${amount}`);
  notifyAdmin(`Card top-up queued — user #${userId} wants to add $${amount.toFixed(2)} to card. StroWallet merchant balance low.`);
}

export async function enqueueCardCreate(userId: number, amount: number, errorMsg: string) {
  await db.insert(cardQueueTable).values({
    userId,
    type: "create",
    amount: amount.toFixed(2),
    status: "pending",
    errorMessage: errorMsg,
  });
  console.log(`[Queue] Enqueued create: userId=${userId} amount=${amount}`);
  notifyAdmin(`Card creation queued — user #${userId}. StroWallet merchant balance low.`);
}

function notifyAdmin(message: string) {
  PushNotify.appealAdmin(0).catch(() => {});
  const pub = cleanKey(process.env.STROWALLET_PUBLIC_KEY ?? "");
  if (pub) {
    console.log(`[Queue] Admin notification: ${message}`);
  }
}

export async function processCardQueue() {
  if (!process.env.STROWALLET_PUBLIC_KEY) return;

  const merchantBal = await getMerchantBalance();
  console.log(`[Queue] StroWallet merchant balance: $${merchantBal}`);

  if (merchantBal < 2) {
    console.log("[Queue] Merchant balance too low — skipping queue processing");
    return;
  }

  // Reset any items stuck in "processing" for more than 10 minutes (server restart mid-run)
  try {
    await db.update(cardQueueTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(sql`${cardQueueTable.status} = 'processing' AND ${cardQueueTable.lastAttempt} < NOW() - INTERVAL '10 minutes'`);
    console.log("[Queue] Recovered any stuck 'processing' items back to pending");
  } catch { /* ignore */ }

  const pending = await db.select().from(cardQueueTable)
    .where(eq(cardQueueTable.status, "pending"));

  if (!pending.length) {
    console.log("[Queue] No pending items");
    return;
  }

  console.log(`[Queue] Processing ${pending.length} pending item(s)...`);

  for (const item of pending) {
    try {
      await db.update(cardQueueTable).set({
        status: "processing",
        attempts: (item.attempts ?? 0) + 1,
        lastAttempt: new Date(),
        updatedAt: new Date(),
      }).where(eq(cardQueueTable.id, item.id));

      if (item.type === "create" && item.userId) {
        // Look up user + KYC data to rebuild the full card creation request
        const user = await db.select().from(usersTable).where(eq(usersTable.id, item.userId)).then(r => r[0]);
        const kyc = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, item.userId)).then(r => r[0]);

        if (!user || !kyc || kyc.status !== "verified") {
          await db.update(cardQueueTable).set({
            status: "failed",
            errorMessage: "User or verified KYC not found",
            updatedAt: new Date(),
          }).where(eq(cardQueueTable.id, item.id));
          console.log(`[Queue] Create failed for item #${item.id}: missing user or KYC`);
          continue;
        }

        const nameParts = (kyc.fullName ?? "").trim().split(/\s+/);
        const firstName = nameParts[0] ?? "N/A";
        const lastName = nameParts.slice(1).join(" ") || firstName;
        const fullName = kyc.fullName ?? `${firstName} ${lastName}`;
        const dob = formatDob(kyc.dateOfBirth ?? "01/01/1990");
        const idType = mapIdType(kyc.idType ?? "national_id");
        const phone = (user.phone ?? "").trim() || "0900000000";
        const initialLoad = await getInitialLoad();
        const creationFee = parseFloat(item.amount ?? "2");

        const url = new URL(`${STRO_BASE}/create-nfc-card`);
        const body = {
          public_key: cleanKey(process.env.STROWALLET_PUBLIC_KEY ?? ""),
          secret_key: cleanKey(process.env.STROWALLET_SECRET_KEY ?? ""),
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          dob,
          id_type: idType,
          id_number: `ETH${String(item.userId).padStart(8, "0")}`,
          email: user.email,
          phone,
          line1: "3401 N. Miami, Ave. Ste 230",
          city: "Miami",
          state: "Florida",
          postal_code: "33127",
          country: "USA",
          amount_usd: String(initialLoad),
          mode: "live",
        };

        console.log(`[Queue] Retrying card creation for user ${item.userId} — initialLoad: $${initialLoad}`);
        const raw = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => r.json()).catch(e => ({ success: false, message: String(e) }));

        console.log(`[Queue] Create retry response for item #${item.id}:`, JSON.stringify(raw));

        const stroOk = raw?.success === true || raw?.status === true || raw?.card_id;

        if (stroOk) {
          const resp = raw?.response ?? raw?.data ?? raw;
          const cardId = resp?.card_id ?? raw?.card_id;
          const cardUserId = resp?.card_user_id ?? "";
          const customerId = resp?.customer_id ?? "";
          const nameOnCard = resp?.name_on_card ?? "";
          const cardType = resp?.card_type ?? "";
          const cardBrand = resp?.card_brand ?? "";
          const reference = resp?.reference ?? "";
          const cardCreatedDate = resp?.card_created_date ?? "";

          // Mark completed FIRST — before any further logic that might throw
          await db.update(cardQueueTable).set({ status: "completed", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));

          // Guard against duplicates — only insert if no card exists for this user yet
          const existing = await db.select().from(cardsTable).where(eq(cardsTable.userId, item.userId)).limit(1);
          if (cardId && existing.length === 0) {
            // Fetch full card details from StroWallet to get last4, cvv, expiry, name, etc.
            const detail = await stroFetchCardDetail(cardId);
            const pick = (...vals: any[]) => vals.find(v => v !== null && v !== undefined && v !== "") ?? null;
            const fullName = detail?.card_holder_name ?? detail?.name_on_card ?? detail?.card_name ?? nameOnCard;
            const last4 = detail?.last4 ?? (detail?.card_number ? String(detail.card_number).slice(-4) : null);

            await db.insert(cardsTable).values({
              userId: item.userId,
              cardId,
              cardUserId:      pick(detail?.card_user_id,    cardUserId)    ?? "",
              customerId:      pick(detail?.customer_id,     customerId)    ?? "",
              nameOnCard:      fullName                                      ?? "",
              cardStatus:      "active",
              cardNumber:      detail?.card_number                           ?? null,
              last4,
              cvv:             detail?.cvv                                   ?? null,
              expiry:          detail?.expiry                                ?? null,
              cardType:        pick(detail?.card_type,       cardType)      ?? "",
              cardBrand:       pick(detail?.card_brand,      cardBrand)     ?? "",
              reference:       pick(detail?.reference,       reference)     ?? "",
              cardCreatedDate: pick(detail?.card_created_date, cardCreatedDate) ?? "",
              customerEmail:   detail?.customer_email                        ?? null,
              balance:         detail?.balance                               ?? String(initialLoad),
            }).catch(e => console.error("[Queue] Card insert error:", e));
            console.log(`[Queue] Card detail enriched — last4:${last4} name:${fullName}`);
          } else if (existing.length > 0) {
            console.log(`[Queue] Card already exists for user ${item.userId} — skipping insert`);
          }

          // Deduct the initial load from user wallet (creation fee was already deducted earlier)
          const wallet = await db.query.walletsTable.findFirst({ where: eq(walletsTable.userId, item.userId) });
          if (wallet) {
            const newBal = (parseFloat(wallet.availableBalance) - initialLoad).toFixed(6);
            await db.update(walletsTable).set({ availableBalance: newBal, updatedAt: new Date() }).where(eq(walletsTable.userId, item.userId));
          }

          await db.insert(transactionsTable).values({
            userId: item.userId, type: "withdraw", amount: String(initialLoad),
            status: "completed", note: "Card created (queued)",
          }).catch(() => {});

          PushNotify.cardReady(item.userId).catch(console.error);
          console.log(`[Queue] Card created for user ${item.userId}, cardId: ${cardId}`);
        } else {
          const msg = typeof raw?.message === "object"
            ? JSON.stringify(raw.message)
            : String(raw?.message ?? raw?.error ?? "Unknown error");
          const lc = msg.toLowerCase();

          const isInsufficient = lc.includes("insufficient") || lc.includes("balance") || raw?.required !== undefined;

          if (isInsufficient) {
            // Keep as pending — merchant balance still low
            await db.update(cardQueueTable).set({
              status: "pending",
              errorMessage: `StroWallet: ${msg}`,
              updatedAt: new Date(),
            }).where(eq(cardQueueTable.id, item.id));
            console.log(`[Queue] Merchant balance still insufficient for item #${item.id} — back to pending`);
          } else {
            // Permanent failure — refund creation fee
            await db.update(cardQueueTable).set({
              status: "failed",
              errorMessage: `StroWallet: ${msg}`,
              updatedAt: new Date(),
            }).where(eq(cardQueueTable.id, item.id));
            const wallet = await db.query.walletsTable.findFirst({ where: eq(walletsTable.userId, item.userId) });
            if (wallet) {
              const refunded = (parseFloat(wallet.availableBalance) + creationFee).toFixed(6);
              await db.update(walletsTable).set({ availableBalance: refunded, updatedAt: new Date() }).where(eq(walletsTable.userId, item.userId));
            }
            PushNotify.cardDeclined(item.userId, String(creationFee), `Card creation failed: ${msg}`).catch(console.error);
            console.log(`[Queue] Card creation permanently failed for user ${item.userId} — fee refunded`);
          }
        }
      } else if (item.type === "fund" && item.cardId && item.userId) {
        const url = stroUrl("fund-withdraw-nfccard");
        url.searchParams.set("card_id", item.cardId);
        url.searchParams.set("amount", item.amount ?? "0");
        url.searchParams.set("type", "fund");

        const res = await fetch(url.toString(), { method: "POST" });
        const raw = await res.json();
        console.log(`[Queue] Fund retry response for item #${item.id}:`, JSON.stringify(raw));

        if (raw?.success) {
          await db.update(cardQueueTable).set({ status: "completed", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));
          await db.insert(transactionsTable).values({ userId: item.userId, type: "withdraw", amount: item.amount ?? "0", status: "completed", note: "Funded Xendrx card (queued)" });

          const newBal = String(parseFloat(raw?.response?.balance ?? "0") || 0);
          if (newBal !== "0") {
            await db.update(cardsTable).set({ balance: newBal, updatedAt: new Date() }).where(eq(cardsTable.cardId, item.cardId));
          }

          PushNotify.cardTopup(item.userId, item.amount ?? "0").catch(console.error);
          console.log(`[Queue] Fund completed for user ${item.userId}`);
        } else if (raw?.message?.toLowerCase().includes("insufficient") || raw?.required) {
          await db.update(cardQueueTable).set({ status: "pending", errorMessage: raw?.message ?? "Still insufficient", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));
          console.log(`[Queue] Still insufficient for item #${item.id} — back to pending`);
        } else {
          await db.update(cardQueueTable).set({ status: "failed", errorMessage: raw?.message ?? "Unknown error", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));
          // Refund platform balance
          const wallet = await db.query.walletsTable.findFirst({ where: eq(walletsTable.userId, item.userId) });
          if (wallet) {
            const refunded = (parseFloat(wallet.availableBalance) + parseFloat(item.amount ?? "0")).toFixed(6);
            await db.update(walletsTable).set({ availableBalance: refunded, updatedAt: new Date() }).where(eq(walletsTable.userId, item.userId));
          }
          PushNotify.cardDeclined(item.userId, item.amount ?? "0", "Queue processing failed — balance refunded").catch(console.error);
        }
      }

      // Small delay between retries
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Queue] Error processing item #${item.id}:`, err);
      // Only reset to pending if not already completed — prevents re-running successful items
      const current = await db.select({ status: cardQueueTable.status }).from(cardQueueTable).where(eq(cardQueueTable.id, item.id)).limit(1);
      if (current[0]?.status !== "completed" && current[0]?.status !== "failed") {
        await db.update(cardQueueTable).set({ status: "pending", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));
      }
    }
  }

  console.log("[Queue] Processing complete");
}

export function startCardQueueProcessor() {
  console.log("[Queue] Card queue processor started (5-min interval)");
  setTimeout(() => processCardQueue().catch(console.error), 20_000);
  setInterval(() => processCardQueue().catch(console.error), 5 * 60_000);
}
