/**
 * Order expiry monitor — runs every 60s and auto-cancels unpaid orders
 * whose payment window has elapsed. Returns frozen USDT to the seller,
 * restores ad available amount, PAUSES the ad (sets offline with pauseReason),
 * and notifies both parties.
 */

import { db } from "@workspace/db";
import {
  ordersTable,
  adsTable,
  walletsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { notify } from "./notify.js";
import { PushNotify } from "../routes/push.js";
import { TelegramNotify } from "../telegram/notify.js";
import { emitToUser } from "./sse.js";

let expiryInterval: ReturnType<typeof setInterval> | null = null;

async function returnUsdtToSeller(sellerId: number, amountUsdt: string) {
  const amount = parseFloat(amountUsdt);
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, sellerId));
  if (!wallet) return;
  const available = parseFloat(wallet.availableBalance);
  const frozen = parseFloat(wallet.frozenBalance);
  await db.update(walletsTable).set({
    availableBalance: (available + amount).toFixed(4),
    frozenBalance: Math.max(0, frozen - amount).toFixed(4),
  }).where(eq(walletsTable.userId, sellerId));
}

async function pollExpiredOrders() {
  try {
    // Find unpaid orders where createdAt + paymentTimeLimit minutes < now
    const expired = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "unpaid"),
          lt(
            sql`${ordersTable.createdAt} + (${ordersTable.paymentTimeLimit} * interval '1 minute')`,
            sql`now()`,
          ),
        ),
      );

    if (expired.length === 0) return;

    logger.info({ count: expired.length }, "[OrderExpiry] Auto-cancelling expired unpaid orders");

    for (const order of expired) {
      try {
        logger.info({ orderId: order.id, sellerId: order.sellerId, buyerId: order.buyerId, adId: order.adId, amountUsdt: order.amountUsdt },
          "[OrderExpiry] Processing expired order");

        // 1. Mark order cancelled
        await db.update(ordersTable)
          .set({ status: "cancelled", cancelReason: "Payment time limit expired" })
          .where(eq(ordersTable.id, order.id));

        logger.info({ orderId: order.id }, "[OrderExpiry] Order marked cancelled");

        // 2. Fetch the ad first — we need its type to decide whether to touch wallet balances
        const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, order.adId));

        // 3. Return frozen USDT to seller ONLY for buy-ad orders.
        //    For sell-ad orders, USDT was frozen at ad-creation time for the full ad amount —
        //    wallet frozenBalance stays unchanged; only ad.availableAmount is restored below.
        //    For buy-ad orders, USDT was frozen per-order → return to available on expiry.
        if (!ad || ad.type === "buy") {
          await returnUsdtToSeller(order.sellerId, order.amountUsdt);
          logger.info({ orderId: order.id, sellerId: order.sellerId, amountUsdt: order.amountUsdt },
            "[OrderExpiry] Buy-ad order expired — USDT returned to seller wallet");
        } else {
          logger.info({ orderId: order.id, sellerId: order.sellerId, amountUsdt: order.amountUsdt },
            "[OrderExpiry] Sell-ad order expired — wallet unchanged (USDT stays frozen for ad)");
        }

        // 4. Restore ad available amount AND pause the ad (set offline with reason)
        if (ad) {
          const restored = parseFloat(ad.availableAmount) + parseFloat(order.amountUsdt);
          const cap = parseFloat(ad.totalAmount);
          const restoredCapped = Math.min(restored, cap).toFixed(4);

          const pauseReason = `Order #${order.id} expired — payment was not received within ${order.paymentTimeLimit} minutes. Please review and reactivate your ad when ready.`;

          await db.update(adsTable)
            .set({
              availableAmount: restoredCapped,
              status: "offline",
              pauseReason,
            })
            .where(eq(adsTable.id, order.adId));

          logger.info({ orderId: order.id, adId: order.adId, restoredAmount: restoredCapped, adType: ad.type },
            "[OrderExpiry] Ad balance restored and ad PAUSED (offline)");
        } else {
          logger.warn({ orderId: order.id, adId: order.adId }, "[OrderExpiry] Ad not found — could not pause");
        }

        // 4. System chat message
        await db.insert(messagesTable).values({
          orderId: order.id,
          senderId: 0,
          receiverId: order.buyerId,
          content: `Order #${order.id} was automatically cancelled because payment was not made within ${order.paymentTimeLimit} minutes. The seller's funds have been returned. The seller's ad has been paused for security.`,
          type: "system",
          isRead: false,
        });

        // 5. Notify buyer (did not receive USDT — no balance change)
        await notify({
          userId: order.buyerId,
          type: "order_cancelled",
          title: "⏰ Order Expired",
          message: `Order #${order.id} was cancelled — payment was not completed within ${order.paymentTimeLimit} minutes.`,
          relatedOrderId: order.id,
        });

        // 6. Notify seller (USDT returned, ad paused)
        await notify({
          userId: order.sellerId,
          type: "order_cancelled",
          title: "⏰ Order Expired — Ad Paused",
          message: `Order #${order.id} expired because the buyer did not pay. Your ${parseFloat(order.amountUsdt).toFixed(4)} USDT has been returned to your wallet. Your ad has been paused — please review and reactivate it when ready.`,
          relatedOrderId: order.id,
        });

        logger.info({ orderId: order.id, sellerId: order.sellerId, amountUsdt: order.amountUsdt },
          "[OrderExpiry] Notifications sent to buyer and seller");

        PushNotify.orderCancelled(order.buyerId, order.id).catch(() => {});
        PushNotify.orderCancelled(order.sellerId, order.id).catch(() => {});
        TelegramNotify.orderCancelled(order.sellerId, order.id).catch(() => {});

        emitToUser(order.buyerId, "order_update", { orderId: order.id, status: "cancelled", type: "order_expired" });
        emitToUser(order.sellerId, "order_update", { orderId: order.id, status: "cancelled", type: "order_expired" });
        emitToUser(order.sellerId, "wallet_update", {});
        // Emit ad_update so seller's ads page refreshes and shows the paused banner
        emitToUser(order.sellerId, "ad_update", { adId: order.adId, status: "offline", paused: true });

        logger.info({ orderId: order.id, sellerId: order.sellerId, adId: order.adId, amountUsdt: order.amountUsdt },
          "[OrderExpiry] Order auto-cancelled — USDT returned to seller, ad paused");
      } catch (err) {
        logger.error({ err, orderId: order.id }, "[OrderExpiry] Failed to auto-cancel order");
      }
    }
  } catch (err) {
    logger.error({ err }, "[OrderExpiry] Poll error");
  }
}

export function startOrderExpiryMonitor() {
  if (expiryInterval) return;
  logger.info("[OrderExpiry] Starting order expiry monitor (60s interval)");
  pollExpiredOrders();
  expiryInterval = setInterval(pollExpiredOrders, 60_000);
}

export function stopOrderExpiryMonitor() {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
    logger.info("[OrderExpiry] Order expiry monitor stopped");
  }
}
