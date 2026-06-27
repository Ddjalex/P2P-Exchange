import { db } from "@workspace/db";
import { cardQueueTable, cardsTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { PushNotify } from "../routes/push.js";

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

      if (item.type === "fund" && item.cardId && item.userId) {
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
      await db.update(cardQueueTable).set({ status: "pending", updatedAt: new Date() }).where(eq(cardQueueTable.id, item.id));
    }
  }

  console.log("[Queue] Processing complete");
}

export function startCardQueueProcessor() {
  console.log("[Queue] Card queue processor started (5-min interval)");
  setTimeout(() => processCardQueue().catch(console.error), 20_000);
  setInterval(() => processCardQueue().catch(console.error), 5 * 60_000);
}
