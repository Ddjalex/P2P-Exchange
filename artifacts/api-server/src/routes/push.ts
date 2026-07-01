import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db";
import { eq } from "drizzle-orm";
import webpush from "web-push";

const router = Router();

// Lazy VAPID setup — called before first send, not at module load
let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL ?? "support@xendrx.com"}`,
      pub,
      priv
    );
    vapidReady = true;
    return true;
  } catch (e) {
    console.error("VAPID setup error:", e);
    return false;
  }
}

// GET /api/push/vapid-public-key — frontend fetches this to subscribe
router.get("/vapid-public-key", (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
});

// POST /api/push/subscribe — save browser push subscription
router.post("/subscribe", async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = (req as any).userId;

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    await db.insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        subscription: JSON.stringify(subscription),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          subscription: JSON.stringify(subscription),
        },
      });

    res.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// GET /api/push/send-test — send a test push to the current user (auth required)
router.get("/send-test", async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const vapidOk = ensureVapid();
  if (!vapidOk) {
    return res.status(500).json({ error: "VAPID keys not configured on server" });
  }

  try {
    const subs = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (!subs.length) {
      return res.json({ success: false, subscriptions: 0, message: "No push subscriptions found for this user" });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          const subscriptionObj = JSON.parse(sub.subscription);
          await webpush.sendNotification(
            subscriptionObj,
            JSON.stringify({
              title: "🔔 Test Notification",
              body: "Push notifications are working correctly on Xendrx!",
              type: "test",
              url: "/",
              tag: `test-${Date.now()}`,
            }),
            { urgency: "high", TTL: 60 }
          );
          sent++;
        } catch (err: any) {
          failed++;
          errors.push(String(err?.message ?? err));
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      })
    );

    return res.json({ success: sent > 0, subscriptions: subs.length, sent, failed, errors });
  } catch (err) {
    console.error("Push send-test error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/push/unsubscribe — remove subscription
router.delete("/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;

// ── Core send helper ──────────────────────────────────────────────────────────

async function sendPush(
  userId: number,
  payload: {
    title: string;
    body: string;
    type: string;
    url?: string;
    orderId?: number;
    tag?: string;
    image?: string;
  }
): Promise<void> {
  if (!ensureVapid()) {
    console.warn('[Push] VAPID not ready — skipping push for userId=%d', userId);
    return;
  }

  try {
    const subs = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    console.log('[Push] Sending to userId:', userId, 'subscriptions found:', subs.length);
    if (!subs.length) return;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          const subscriptionObj = JSON.parse(sub.subscription);
          await webpush.sendNotification(
            subscriptionObj,
            JSON.stringify(payload),
            { urgency: payload.type === "new_message" ? "normal" : "high", TTL: 86400 }
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      })
    );
  } catch (error) {
    console.error("Push send failed:", error);
  }
}

// ── Notification payloads ─────────────────────────────────────────────────────

export const PushNotify = {
  async newOrder(sellerId: number, orderId: number, usdtAmount: string, etbAmount: string) {
    await sendPush(sellerId, {
      title: "🔔 New Order Received!",
      body: `${usdtAmount} USDT — Br ${etbAmount}. Respond quickly!`,
      type: "order_created",
      url: `/trade/${orderId}`,
      orderId,
      tag: `order-${orderId}`,
    });
  },

  async paymentSent(sellerId: number, orderId: number, etbAmount: string) {
    await sendPush(sellerId, {
      title: "💰 Payment Marked as Sent!",
      body: `Buyer sent Br ${etbAmount}. Verify and release crypto.`,
      type: "payment_sent",
      url: `/trade/${orderId}`,
      orderId,
      tag: `paid-${orderId}`,
    });
  },

  async orderCompleted(buyerId: number, orderId: number, usdtAmount: string) {
    await sendPush(buyerId, {
      title: "✅ Order Completed!",
      body: `${usdtAmount} USDT deposited to your wallet!`,
      type: "order_completed",
      url: "/wallet",
      orderId,
      tag: `completed-${orderId}`,
    });
  },

  async orderCancelled(userId: number, orderId: number) {
    await sendPush(userId, {
      title: "❌ Order Cancelled",
      body: "Your order has been cancelled.",
      type: "order_cancelled",
      url: "/orders",
      orderId,
      tag: `cancelled-${orderId}`,
    });
  },

  async newMessage(receiverId: number, orderId: number, senderName: string, preview: string) {
    await sendPush(receiverId, {
      title: `💬 ${senderName}`,
      body: preview.slice(0, 80),
      type: "new_message",
      url: `/chat/${orderId}`,
      orderId,
      tag: `msg-${orderId}`,
    });
  },

  async appealRaised(userId: number, orderId: number) {
    await sendPush(userId, {
      title: "⚠️ Appeal Raised",
      body: "An appeal has been filed. Admin will review shortly.",
      type: "appeal_raised",
      url: `/trade/${orderId}`,
      orderId,
      tag: `appeal-${orderId}`,
    });
  },

  async kycApproved(userId: number) {
    await sendPush(userId, {
      title: "✅ Identity Verified!",
      body: "Your KYC is approved. You can now trade on Xendrx!",
      type: "kyc_approved",
      url: "/p2p",
      tag: "kyc-approved",
    });
  },

  async kycRejected(userId: number, reason: string) {
    await sendPush(userId, {
      title: "❌ KYC Rejected",
      body: `Reason: ${reason}. Please resubmit.`,
      type: "kyc_rejected",
      url: "/kyc",
      tag: "kyc-rejected",
    });
  },

  async withdrawalApproved(userId: number, amount: string) {
    await sendPush(userId, {
      title: "✅ Withdrawal Approved",
      body: `${amount} USDT is being processed.`,
      type: "withdrawal_approved",
      url: "/wallet",
      tag: "withdrawal",
    });
  },

  async withdrawalRejected(userId: number, amount: string, reason: string) {
    await sendPush(userId, {
      title: "❌ Withdrawal Rejected",
      body: `${amount} USDT returned. Reason: ${reason}`,
      type: "withdrawal_rejected",
      url: "/wallet",
      tag: "withdrawal-rejected",
    });
  },

  async depositReceived(userId: number, amount: string) {
    await sendPush(userId, {
      title: "💰 Deposit Received",
      body: `${parseFloat(amount).toFixed(2)} USDT has been credited to your account.`,
      type: "deposit_received",
      url: "/wallet",
      tag: `deposit-${Date.now()}`,
    });
  },

  async appealAdmin(orderId: number) {
    await sendPush(1, {
      title: "🚨 New Appeal Filed",
      body: `An appeal has been raised on order #${orderId}. Review now.`,
      type: "appeal_raised",
      url: `/admin/disputes`,
      orderId,
      tag: `admin-appeal-${orderId}`,
    });
  },

  async appealResolved(userId: number, orderId: number, won: boolean) {
    await sendPush(userId, {
      title: won ? "✅ Appeal Decided — You Won" : "❌ Appeal Decided — Counterparty Won",
      body: won
        ? `Your appeal on order #${orderId} was resolved in your favor.`
        : `The appeal on order #${orderId} was decided against you.`,
      type: "appeal_resolved",
      url: `/orders/${orderId}`,
      orderId,
      tag: `appeal-resolved-${orderId}-${userId}`,
    });
  },

  async cardReady(userId: number) {
    await sendPush(userId, {
      title: "🎉 Your Xendrx Card is ready!",
      body: "Your virtual Visa card is active and ready to use.",
      type: "card_ready",
      url: "/card",
      tag: "card-ready",
    });
  },

  async cardTopup(userId: number, amount: string) {
    await sendPush(userId, {
      title: "💳 Card Topped Up",
      body: `+$${parseFloat(amount).toFixed(2)} added to your Xendrx card.`,
      type: "card_topup",
      url: "/card",
      tag: `card-topup-${Date.now()}`,
    });
  },

  async cardUsed(userId: number, amount: string, merchant?: string) {
    await sendPush(userId, {
      title: "💳 Card Used",
      body: merchant
        ? `$${parseFloat(amount).toFixed(2)} at ${merchant}`
        : `$${parseFloat(amount).toFixed(2)} charged to your card`,
      type: "card_used",
      url: "/card",
      tag: `card-used-${Date.now()}`,
    });
  },

  async cardDeclined(userId: number, amount: string, reason?: string) {
    await sendPush(userId, {
      title: "❌ Card Declined",
      body: reason
        ? `$${parseFloat(amount).toFixed(2)} declined — ${reason}`
        : `$${parseFloat(amount).toFixed(2)} transaction was declined`,
      type: "card_declined",
      url: "/card",
      tag: `card-declined-${Date.now()}`,
    });
  },

  async adminAlert(message: string) {
    await sendPush(1, {
      title: "🚨 Security Alert",
      body: message.slice(0, 120),
      type: "admin_alert",
      url: "/admin/security",
      tag: `admin-alert-${Date.now()}`,
    });
  },
};

export async function sendPushBroadcast(
  userIds: number[],
  title: string,
  body: string
): Promise<void> {
  if (!ensureVapid()) return;
  if (!userIds.length) return;
  try {
    const allSubs = await db.select().from(pushSubscriptions);
    const filtered = allSubs.filter(s => userIds.includes(s.userId));
    await Promise.allSettled(
      filtered.map(async (sub) => {
        try {
          const subscriptionObj = JSON.parse(sub.subscription);
          await webpush.sendNotification(
            subscriptionObj,
            JSON.stringify({
              title,
              body,
              type: "broadcast",
              url: "/",
              tag: `broadcast-${Date.now()}`,
            }),
            { urgency: "normal", TTL: 86400 }
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      })
    );
  } catch (error) {
    console.error("Broadcast push failed:", error);
  }
}
