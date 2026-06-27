import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PushNotify } from "./push.js";

const router = Router();

// POST /api/webhooks/card — StroWallet card event webhooks
router.post("/card", async (req, res) => {
  try {
    const body = req.body ?? {};
    const event: string = body.event ?? body.type ?? body.status ?? "";
    const cardId: string = body.card_id ?? body.cardId ?? "";
    const amount: string = String(body.amount ?? "0");
    const reason: string = body.reason ?? body.decline_reason ?? "";
    const merchant: string = body.merchant ?? body.merchant_name ?? body.narrative ?? "";

    console.log("[Card] Webhook received — event:", event, "cardId:", cardId);
    console.log("[Card] Webhook body:", JSON.stringify(body));

    if (!cardId) {
      return res.status(400).json({ error: "Missing card_id" });
    }

    const card = await db.query.cardsTable.findFirst({ where: eq(cardsTable.cardId, cardId) });
    if (!card) {
      console.log("[Card] Webhook — card not found in DB:", cardId);
      return res.json({ received: true });
    }

    const userId = card.userId!;

    switch (event) {
      case "virtualcard.created.complete": {
        await db.update(cardsTable)
          .set({ cardStatus: "active", updatedAt: new Date() })
          .where(eq(cardsTable.cardId, cardId));
        console.log("[Card] Webhook — card activated:", cardId);
        PushNotify.cardReady(userId).catch(console.error);
        break;
      }

      case "virtualcard.topup.complete": {
        const newBalance = (parseFloat(card.balance) + parseFloat(amount)).toFixed(2);
        await db.update(cardsTable)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(cardsTable.cardId, cardId));
        console.log("[Card] Webhook — card topped up:", cardId, "amount:", amount);
        PushNotify.cardTopup(userId, amount).catch(console.error);
        break;
      }

      case "virtualcard.transaction.authorization": {
        console.log("[Card] Webhook — card used for purchase:", cardId, "amount:", amount, "merchant:", merchant);
        PushNotify.cardUsed(userId, amount, merchant || undefined).catch(console.error);
        break;
      }

      case "virtualcard.transaction.declined": {
        console.log("[Card] Webhook — card declined:", cardId, "amount:", amount, "reason:", reason);
        PushNotify.cardDeclined(userId, amount, reason || undefined).catch(console.error);
        break;
      }

      case "virtualcard.transaction.declined.terminated": {
        await db.update(cardsTable)
          .set({ cardStatus: "inactive", updatedAt: new Date() })
          .where(eq(cardsTable.cardId, cardId));
        console.log("[Card] Webhook — card terminated:", cardId);
        break;
      }

      case "virtualcard.withdrawal.success": {
        const withdrawn = parseFloat(amount);
        const newBalance = Math.max(0, parseFloat(card.balance) - withdrawn).toFixed(2);
        await db.update(cardsTable)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(cardsTable.cardId, cardId));
        console.log("[Card] Webhook — card withdrawal:", cardId, "amount:", amount);
        break;
      }

      default:
        console.log("[Card] Webhook — unhandled event:", event);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("[Card] Webhook error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
