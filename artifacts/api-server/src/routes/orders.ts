import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, adsTable, usersTable, messagesTable, appealsTable, feedbackTable, walletsTable, paymentMethodsTable, transactionsTable, feeTransactionsTable, platformWalletTable, kycSubmissionsTable } from "@workspace/db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { notify } from "../lib/notify.js";
import { getFeePercents, calculateFees } from "../helpers/fees.js";
import { PushNotify } from "./push.js";
import { TelegramNotify } from "../telegram/notify.js";
import { emitToUser } from "../lib/sse.js";

const router = Router();

// ── Wallet helpers ────────────────────────────────────────────────────────────

async function getOrCreateWallet(userId: number) {
  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).then(r => r[0]);
  if (!wallet) {
    const [w] = await db.insert(walletsTable).values({ userId, availableBalance: "0.00", frozenBalance: "0.00" }).returning();
    wallet = w;
  }
  return wallet;
}

async function freezeSellerUsdt(sellerId: number, amountUsdt: string) {
  const wallet = await getOrCreateWallet(sellerId);
  const available = parseFloat(wallet.availableBalance);
  const frozen = parseFloat(wallet.frozenBalance);
  const amount = parseFloat(amountUsdt);
  if (available >= amount) {
    await db.update(walletsTable).set({
      availableBalance: (available - amount).toFixed(4),
      frozenBalance: (frozen + amount).toFixed(4),
    }).where(eq(walletsTable.userId, sellerId));
  }
}

async function returnUsdtToSeller(sellerId: number, amountUsdt: string) {
  const amount = parseFloat(amountUsdt);
  const wallet = await getOrCreateWallet(sellerId);
  const available = parseFloat(wallet.availableBalance);
  const frozen = parseFloat(wallet.frozenBalance);
  await db.update(walletsTable).set({
    availableBalance: (available + amount).toFixed(4),
    frozenBalance: Math.max(0, frozen - amount).toFixed(4),
  }).where(eq(walletsTable.userId, sellerId));
}

// ── Get seller payment details for a given payment method ─────────────────────

async function getSellerPaymentDetails(sellerId: number, paymentMethod: string): Promise<{ accountName: string; accountNumber: string }> {
  const methods = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.userId, sellerId));
  if (methods.length === 0) return { accountName: "", accountNumber: "" };

  const pm = paymentMethod.toLowerCase().replace(/\s+/g, "");
  const match = methods.find(m => {
    const t = m.type.toLowerCase().replace(/\s+/g, "");
    return t === pm || pm.startsWith(t) || t.startsWith(pm);
  }) ?? methods[0];

  return { accountName: match.accountName, accountNumber: match.accountNumber };
}

// ── Format order ──────────────────────────────────────────────────────────────

async function formatOrder(order: any, viewerId?: number) {
  const buyer = await db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)).then(r => r[0]);
  const seller = await db.select().from(usersTable).where(eq(usersTable.id, order.sellerId)).then(r => r[0]);
  const buyerKyc = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.userId, order.buyerId)).then(r => r[0]);

  let unreadCount = 0;
  if (viewerId) {
    unreadCount = await db.select().from(messagesTable).where(
      and(
        eq(messagesTable.orderId, order.id),
        eq(messagesTable.receiverId, viewerId),
        eq(messagesTable.isRead, false)
      )
    ).then(r => r.length);
  }

  const { accountName, accountNumber } = await getSellerPaymentDetails(order.sellerId, order.paymentMethod);

  return {
    id: order.id,
    adId: order.adId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    buyerUsername: buyer?.username ?? "Unknown",
    buyerKycName: buyerKyc?.fullName ?? null,
    sellerUsername: seller?.username ?? "Unknown",
    amountUsdt: order.amountUsdt,
    amountEtb: order.amountEtb,
    price: order.price,
    paymentMethod: order.paymentMethod,
    paymentTimeLimit: order.paymentTimeLimit,
    status: order.status,
    cancelReason: order.cancelReason ?? null,
    unreadCount,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    completedAt: order.completedAt ?? null,
    frozenAt: order.frozenAt ?? null,
    releasedAt: order.releasedAt ?? null,
    appealAvailableAt: order.appealAvailableAt ?? null,
    adminNote: order.adminNote ?? null,
    sellerAccountName: accountName,
    sellerAccountNumber: accountNumber,
    makerFeePercent: order.makerFeePercent ?? "0.20",
    takerFeePercent: order.takerFeePercent ?? "0.10",
    makerFeeAmount: order.makerFeeAmount ?? "0",
    takerFeeAmount: order.takerFeeAmount ?? "0",
    makerNetAmount: order.makerNetAmount ?? "0",
    takerNetAmount: order.takerNetAmount ?? "0",
  };
}

// ── LIST ORDERS ───────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { tab, status } = req.query as Record<string, string>;
    const userId = (req as any).userId;

    const conditions = [
      or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId))!
    ];

    if (status && ["unpaid", "paid", "completed", "cancelled", "appeal"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as any));
    }

    const orders = await db.select().from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt));

    let filtered = orders;
    if (!status) {
      if (tab === "ongoing") {
        filtered = orders.filter(o => ["unpaid", "paid", "appeal"].includes(o.status));
      } else if (tab === "fulfilled") {
        filtered = orders.filter(o => ["completed", "cancelled"].includes(o.status));
      }
    }

    const formatted = await Promise.all(filtered.map(o => formatOrder(o, userId)));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CREATE ORDER ──────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const { adId, amountUsdt, amountEtb, paymentMethod } = req.body;
    const userId = (req as any).userId;

    if (!adId) return res.status(400).json({ message: "Advertisement not found" });
    if (!paymentMethod) return res.status(400).json({ message: "Please select a payment method" });

    const ad = await db.select().from(adsTable).where(eq(adsTable.id, adId)).then(r => r[0]);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });
    if (ad.status !== "online") return res.status(400).json({ message: "This ad is no longer available" });
    if (ad.userId === userId) return res.status(400).json({ message: "Cannot trade your own advertisement" });

    const etb = parseFloat(amountEtb);
    const usdtRequested = parseFloat(amountUsdt);
    const minLimit = parseFloat(ad.minLimit);
    const maxLimit = parseFloat(ad.maxLimit);
    if (minLimit > 0 && usdtRequested < minLimit) return res.status(400).json({ message: `Minimum order amount is ${minLimit.toLocaleString()} USDT` });
    if (maxLimit > 0 && usdtRequested > maxLimit) return res.status(400).json({ message: `Maximum order amount is ${maxLimit.toLocaleString()} USDT` });

    const adPaymentMethods: string[] = JSON.parse(ad.paymentMethods);
    const pmLower = paymentMethod.toLowerCase().replace(/\s+/g, "");
    const validPm = adPaymentMethods.some(m => {
      const ml = m.toLowerCase().replace(/\s+/g, "");
      return ml === pmLower || ml.startsWith(pmLower) || pmLower.startsWith(ml);
    });
    if (!validPm) return res.status(400).json({ message: "Invalid payment method for this ad" });

    const usdt = parseFloat(amountUsdt);
    const available = parseFloat(ad.availableAmount);
    if (usdt > available) return res.status(400).json({ message: "Insufficient ad balance. Please reduce your amount." });

    const isBuying = ad.type === "sell";
    const buyerId = isBuying ? userId : ad.userId;
    const sellerId = isBuying ? ad.userId : userId;

    // For sell-ad orders (buyer paying seller): verify the seller has complete
    // account details saved for the chosen payment method before creating the order.
    if (isBuying) {
      const { accountName, accountNumber } = await getSellerPaymentDetails(sellerId, paymentMethod);
      if (!accountName || !accountNumber) {
        return res.status(400).json({ message: "Seller has not set up their payment account details for this method. Please choose a different ad or contact the seller." });
      }
    }

    const now = new Date();
    const appealAvailableAt = new Date(now.getTime() + ad.paymentTimeLimit * 60 * 1000);

    // If order creator is the seller (selling to a buy ad), check they have sufficient USDT
    if (!isBuying) {
      const sellerWallet = await getOrCreateWallet(sellerId);
      const sellerAvailable = parseFloat(sellerWallet.availableBalance);
      if (sellerAvailable < usdt) {
        return res.status(400).json({ message: "Insufficient USDT balance to create this sell order" });
      }
    }

    const [order] = await db.insert(ordersTable).values({
      adId,
      buyerId,
      sellerId,
      amountUsdt,
      amountEtb,
      price: ad.price,
      paymentMethod,
      paymentTimeLimit: ad.paymentTimeLimit,
      status: "unpaid",
      frozenAt: now,
      appealAvailableAt,
    }).returning();

    // If selling to a buy ad, freeze the seller's USDT now (escrow per order)
    if (!isBuying) {
      await freezeSellerUsdt(sellerId, amountUsdt);
    }

    const newAvailable = Math.max(0, available - usdt);
    await db.update(adsTable).set({
      availableAmount: newAvailable.toFixed(4),
    }).where(eq(adsTable.id, adId));

    await db.insert(messagesTable).values({
      orderId: order.id,
      senderId: 0,
      receiverId: buyerId,
      content: "Your order has been created. Please complete the payment promptly.",
      type: "system",
      isRead: false,
    });

    // Send the ad poster's auto-reply (if set) as the first chat message
    if (ad.autoReply && ad.autoReply.trim()) {
      const autoReplyReceiverId = userId; // always the order creator
      await db.insert(messagesTable).values({
        orderId: order.id,
        senderId: ad.userId,
        receiverId: autoReplyReceiverId,
        content: ad.autoReply.trim(),
        type: "text",
        isRead: false,
      });
      const adPoster = await db.select().from(usersTable).where(eq(usersTable.id, ad.userId)).then(r => r[0]);
      emitToUser(autoReplyReceiverId, "new_message", {
        orderId: order.id,
        senderUsername: adPoster?.username ?? "Trader",
      });
    }

    await notify({
      userId: sellerId,
      type: "order_created",
      title: "🔔 New Order",
      message: `New order received for ${parseFloat(order.amountUsdt).toFixed(4)} USDT (Br ${Number(order.amountEtb).toLocaleString()})`,
      relatedOrderId: order.id,
    });
    PushNotify.newOrder(sellerId, order.id, parseFloat(order.amountUsdt).toFixed(4), Number(order.amountEtb).toLocaleString()).then(() => {
      console.log('[Push] newOrder sent: userId=%d orderId=%d', sellerId, order.id);
    }).catch(err => {
      console.error('[Push] newOrder FAILED:', err.message, err.stack);
    });
    TelegramNotify.newOrder(sellerId, order.id, parseFloat(order.amountUsdt).toFixed(4), Number(order.amountEtb).toLocaleString()).catch(console.error);
    emitToUser(sellerId, "order_update", { orderId: order.id, status: "unpaid", type: "order_created" });
    emitToUser(buyerId, "order_update", { orderId: order.id, status: "unpaid", type: "order_created" });

    res.status(201).json(await formatOrder(order, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ message: "Order creation failed. Please try again." });
  }
});

// ── GET ORDER ─────────────────────────────────────────────────────────────────

// FIX 4 — active order count (for badge)
router.get("/active-count", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const rows = await db.select().from(ordersTable).where(
      and(
        or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId)),
        or(
          eq(ordersTable.status, "unpaid" as any),
          eq(ordersTable.status, "paid" as any),
          eq(ordersTable.status, "appeal" as any),
        )
      )
    );
    res.json({ count: rows.length });
  } catch {
    res.json({ count: 0 });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(await formatOrder(order, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── MARK PAID ─────────────────────────────────────────────────────────────────

router.post("/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.buyerId !== userId) return res.status(403).json({ message: "Only the buyer can mark as paid" });
    if (order.status !== "unpaid") return res.status(400).json({ message: "Order is not in unpaid status" });

    const [updated] = await db.update(ordersTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: order.sellerId,
      content: "Buyer has marked payment as sent. Please verify and release crypto.",
      type: "system",
      isRead: false,
    });

    await notify({
      userId: order.sellerId,
      type: "payment_sent",
      title: "💰 Payment Sent",
      message: `Buyer has marked payment as sent for order #${id}. Please verify and release crypto.`,
      relatedOrderId: id,
    });
    PushNotify.paymentSent(order.sellerId, id, Number(updated.amountEtb).toLocaleString()).then(() => {
      console.log('[Push] paymentSent sent: userId=%d orderId=%d', order.sellerId, id);
    }).catch(err => {
      console.error('[Push] paymentSent FAILED:', err.message, err.stack);
    });
    TelegramNotify.paymentSent(order.sellerId, id, Number(updated.amountEtb).toLocaleString()).catch(console.error);
    emitToUser(order.sellerId, "order_update", { orderId: id, status: "paid", type: "payment_sent" });
    emitToUser(order.buyerId, "order_update", { orderId: id, status: "paid", type: "payment_sent" });

    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to mark order paid");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── RELEASE CRYPTO ────────────────────────────────────────────────────────────

router.post("/:id/release", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.sellerId !== userId) return res.status(403).json({ message: "Only the seller can release crypto" });
    if (order.status !== "paid") return res.status(400).json({ message: "Order has not been marked as paid" });

    const { makerFeePercent, takerFeePercent } = await getFeePercents();
    const grossUsdt = Number(order.amountUsdt);
    const { makerFee, takerFee, totalFee, netUsdt } = calculateFees(grossUsdt, makerFeePercent, takerFeePercent);

    const ad = await db.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
    const makerId = ad?.userId ?? order.sellerId;
    const takerId = makerId === order.buyerId ? order.sellerId : order.buyerId;
    const buyerReceives = netUsdt;
    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Release seller's escrowed USDT.
      //    • Sell-ad orders: USDT was frozen at ad-creation time → deduct from frozenBalance
      //    • Buy-ad orders: USDT was frozen at order-creation time (same mechanism)
      //    Safety net: if frozenBalance is somehow < grossUsdt, deduct from availableBalance.
      const sellerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.sellerId)).then(r => r[0]);
      if (sellerWallet) {
        const sellerFrozen = parseFloat(sellerWallet.frozenBalance);
        const sellerAvailable = parseFloat(sellerWallet.availableBalance);
        if (sellerFrozen >= grossUsdt) {
          await tx.update(walletsTable)
            .set({ frozenBalance: (sellerFrozen - grossUsdt).toFixed(8) })
            .where(eq(walletsTable.userId, order.sellerId));
        } else {
          // Safety net: deduct whatever remains from frozen then from available
          const fromAvailable = grossUsdt - sellerFrozen;
          await tx.update(walletsTable)
            .set({
              frozenBalance: "0.00000000",
              availableBalance: Math.max(0, sellerAvailable - fromAvailable).toFixed(8),
            })
            .where(eq(walletsTable.userId, order.sellerId));
        }
      }

      // 2. Credit buyer with NET amount (after fees)
      const buyerWallet = await tx.select().from(walletsTable).where(eq(walletsTable.userId, order.buyerId)).then(r => r[0]);
      const buyerAvailable = buyerWallet ? parseFloat(buyerWallet.availableBalance) : 0;
      if (buyerWallet) {
        await tx.update(walletsTable)
          .set({ availableBalance: (buyerAvailable + buyerReceives).toFixed(8) })
          .where(eq(walletsTable.userId, order.buyerId));
      } else {
        await tx.insert(walletsTable).values({
          userId: order.buyerId,
          availableBalance: buyerReceives.toFixed(8),
          frozenBalance: "0.00",
        });
      }

      // 3. Add fees to platform wallet (upsert)
      const existingPlatformWallet = await tx.select().from(platformWalletTable)
        .where(eq(platformWalletTable.asset, "USDT")).then(r => r[0]);
      if (existingPlatformWallet) {
        const current = parseFloat(String(existingPlatformWallet.totalCollected));
        await tx.update(platformWalletTable)
          .set({ totalCollected: (current + totalFee).toFixed(8), updatedAt: now })
          .where(eq(platformWalletTable.asset, "USDT"));
      } else {
        await tx.insert(platformWalletTable).values({ asset: "USDT", totalCollected: totalFee.toFixed(8) });
      }

      // 4. Update order with fee details and complete
      await tx.update(ordersTable)
        .set({
          status: "completed",
          makerFeePercent: String(makerFeePercent),
          takerFeePercent: String(takerFeePercent),
          makerFeeAmount: makerFee.toFixed(8),
          takerFeeAmount: takerFee.toFixed(8),
          makerNetAmount: (grossUsdt - makerFee).toFixed(8),
          takerNetAmount: buyerReceives.toFixed(8),
          releasedAt: now,
          completedAt: now,
        })
        .where(eq(ordersTable.id, id));

      // 5. Log fee transactions
      await tx.insert(feeTransactionsTable).values([
        {
          orderId: id,
          userId: makerId,
          feeType: "maker",
          feePercent: String(makerFeePercent),
          grossAmount: grossUsdt.toFixed(8),
          feeAmount: makerFee.toFixed(8),
          netAmount: (grossUsdt - makerFee).toFixed(8),
        },
        {
          orderId: id,
          userId: takerId,
          feeType: "taker",
          feePercent: String(takerFeePercent),
          grossAmount: grossUsdt.toFixed(8),
          feeAmount: takerFee.toFixed(8),
          netAmount: buyerReceives.toFixed(8),
        },
      ]);

      // 6. Transaction records
      await tx.insert(transactionsTable).values([
        {
          userId: order.buyerId,
          type: "p2p_buy",
          amount: buyerReceives.toFixed(8),
          status: "completed",
          note: `Bought ${grossUsdt} USDT. Fee: ${totalFee.toFixed(8)} USDT. Received: ${buyerReceives.toFixed(8)} USDT`,
        },
        {
          userId: order.sellerId,
          type: "p2p_sell",
          amount: grossUsdt.toFixed(8),
          status: "completed",
          note: `Sold ${grossUsdt} USDT`,
        },
      ]);

      // 7. System chat message
      await tx.insert(messagesTable).values({
        orderId: id,
        senderId: 0,
        receiverId: order.buyerId,
        content: "Seller has released the crypto. Order is now completed!",
        type: "system",
        isRead: false,
      });
    });

    // 8. Notifications (outside tx)
    await notify({
      userId: order.buyerId,
      type: "order_completed",
      title: "✅ Order Completed",
      message: `You received ${buyerReceives.toFixed(4)} USDT (fee: ${totalFee.toFixed(4)} USDT deducted)`,
      relatedOrderId: id,
    });
    await notify({
      userId: order.sellerId,
      type: "order_completed",
      title: "✅ Order Completed",
      message: `Order #${id} completed. Br ${Number(order.amountEtb).toLocaleString()} received.`,
      relatedOrderId: id,
    });
    PushNotify.orderCompleted(order.buyerId, id, buyerReceives.toFixed(4)).then(() => {
      console.log('[Push] orderCompleted sent: userId=%d orderId=%d', order.buyerId, id);
    }).catch(err => {
      console.error('[Push] orderCompleted FAILED:', err.message, err.stack);
    });
    TelegramNotify.orderCompleted(order.buyerId, id, buyerReceives.toFixed(4)).catch(console.error);
    emitToUser(order.buyerId, "order_update", { orderId: id, status: "completed", type: "order_completed" });
    emitToUser(order.buyerId, "wallet_update", {});
    emitToUser(order.sellerId, "order_update", { orderId: id, status: "completed", type: "order_completed" });
    emitToUser(order.sellerId, "wallet_update", {});

    // Remove the ad only now that the sale is confirmed — and only if balance is truly exhausted
    if (order.adId) {
      const completedAd = await db.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
      if (completedAd && parseFloat(completedAd.availableAmount) < 0.0001) {
        await db.delete(adsTable).where(eq(adsTable.id, order.adId));
      }
    }

    const updated = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to release crypto");
    res.status(500).json({ message: "Failed to release crypto" });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────────────────────

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { reason } = req.body || {};
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "unpaid") return res.status(400).json({ message: "Cannot cancel a paid order" });

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", cancelReason: reason ?? null })
      .where(eq(ordersTable.id, id))
      .returning();

    const ad = await db.select().from(adsTable).where(eq(adsTable.id, order.adId)).then(r => r[0]);
    if (ad) {
      const restored = parseFloat(ad.availableAmount) + parseFloat(order.amountUsdt);
      const cap = parseFloat(ad.totalAmount);
      await db.update(adsTable).set({
        availableAmount: Math.min(restored, cap).toFixed(4),
      }).where(eq(adsTable.id, order.adId));
    }

    // Always return the order's USDT to the seller's available balance.
    // • Sell-ad orders: entire ad amount was frozen at ad creation; per-order
    //   amount is moved back to available so the seller isn't locked out.
    // • Buy-ad orders: seller froze USDT at order creation; unfreeze on cancel.
    await returnUsdtToSeller(order.sellerId, order.amountUsdt);

    const cancelledByRole = userId === order.buyerId ? "buyer" : "seller";
    const counterpartyId = userId === order.buyerId ? order.sellerId : order.buyerId;
    await notify({
      userId: counterpartyId,
      type: "order_cancelled",
      title: "❌ Order Cancelled",
      message: `Order #${id} has been cancelled by the ${cancelledByRole}.`,
      relatedOrderId: id,
    });
    PushNotify.orderCancelled(counterpartyId, id).then(() => {
      console.log('[Push] orderCancelled sent: userId=%d orderId=%d', counterpartyId, id);
    }).catch(err => {
      console.error('[Push] orderCancelled FAILED:', err.message, err.stack);
    });
    TelegramNotify.orderCancelled(counterpartyId, id).catch(console.error);
    emitToUser(counterpartyId, "order_update", { orderId: id, status: "cancelled", type: "order_cancelled" });
    emitToUser(userId, "order_update", { orderId: id, status: "cancelled", type: "order_cancelled" });

    res.json(await formatOrder(updated, userId));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── APPEAL ────────────────────────────────────────────────────────────────────

router.post("/:id/appeal", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { reason, description, evidenceUrls = [] } = req.body;

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "paid") return res.status(400).json({ message: "Appeals can only be raised on paid orders" });

    await db.update(ordersTable).set({ status: "appeal" }).where(eq(ordersTable.id, id));

    const [appeal] = await db.insert(appealsTable).values({
      orderId: id,
      raisedBy: userId,
      reason,
      description,
      evidenceUrls: JSON.stringify(evidenceUrls),
      status: "pending",
    }).returning();

    await db.insert(messagesTable).values({
      orderId: id,
      senderId: 0,
      receiverId: userId,
      content: "An appeal has been raised. Admin is reviewing the dispute. USDT is frozen until resolved.",
      type: "system",
      isRead: false,
    });

    const appealCounterpartyId = userId === order.buyerId ? order.sellerId : order.buyerId;
    await notify({
      userId: appealCounterpartyId,
      type: "appeal_raised",
      title: "⚠️ Appeal Raised",
      message: `An appeal has been filed on order #${id}. Admin will review shortly.`,
      relatedOrderId: id,
    });
    await notify({
      userId: 1,
      type: "appeal_admin",
      title: "🚨 New Appeal",
      message: `Appeal filed on order #${id}.`,
      relatedOrderId: id,
    });
    PushNotify.appealRaised(appealCounterpartyId, id).then(() => {
      console.log('[Push] appealRaised sent: userId=%d orderId=%d', appealCounterpartyId, id);
    }).catch(err => {
      console.error('[Push] appealRaised FAILED:', err.message, err.stack);
    });
    PushNotify.appealAdmin(id).then(() => {
      console.log('[Push] appealAdmin sent: orderId=%d', id);
    }).catch(err => {
      console.error('[Push] appealAdmin FAILED:', err.message, err.stack);
    });
    TelegramNotify.appealRaised(appealCounterpartyId, id).catch(console.error);
    emitToUser(appealCounterpartyId, "order_update", { orderId: id, status: "appeal", type: "appeal_raised" });
    emitToUser(userId, "order_update", { orderId: id, status: "appeal", type: "appeal_raised" });

    res.status(201).json({
      id: appeal.id,
      orderId: appeal.orderId,
      raisedBy: appeal.raisedBy,
      reason: appeal.reason,
      description: appeal.description,
      evidenceUrls: JSON.parse(appeal.evidenceUrls),
      status: appeal.status,
      adminDecision: appeal.adminDecision ?? null,
      createdAt: appeal.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to raise appeal");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── FEEDBACK ──────────────────────────────────────────────────────────────────

router.post("/:id/feedback", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).userId;
    const { type, comment } = req.body;
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "completed") return res.status(400).json({ message: "Can only leave feedback on completed orders" });

    const toUserId = userId === order.buyerId ? order.sellerId : order.buyerId;
    const [fb] = await db.insert(feedbackTable).values({
      orderId: id,
      fromUserId: userId,
      toUserId,
      type,
      comment: comment ?? null,
    }).returning();

    res.status(201).json({
      id: fb.id,
      orderId: fb.orderId,
      fromUserId: fb.fromUserId,
      toUserId: fb.toUserId,
      type: fb.type,
      comment: fb.comment ?? null,
      createdAt: fb.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PAYMENT DETAILS ───────────────────────────────────────────────────────────

router.get("/:id/payment-details", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).then(r => r[0]);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const { accountName, accountNumber } = await getSellerPaymentDetails(order.sellerId, order.paymentMethod);
    res.json({ accountName, accountNumber, paymentMethod: order.paymentMethod });
  } catch (err) {
    req.log.error({ err }, "Failed to get payment details");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
