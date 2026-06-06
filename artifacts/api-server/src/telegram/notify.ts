import { sendTelegramMessage } from "./bot.js";
import { db } from "@workspace/db";
import { telegramUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const APP_URL = process.env.APP_URL ?? "";

async function getTgId(userId: number): Promise<string | null> {
  try {
    const tg = await db.select().from(telegramUsersTable)
      .where(eq(telegramUsersTable.userId, userId))
      .then(r => r[0]);
    return tg?.telegramId ?? null;
  } catch {
    return null;
  }
}

export const TelegramNotify = {
  async newOrder(sellerId: number, orderId: number, usdt: string, etb: string) {
    const tgId = await getTgId(sellerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `🔔 *New Order Received!*\n\nAmount: \`${usdt} USDT\`\nETB: \`Br ${etb}\`\n\n⚡ Respond quickly to maintain your rating!`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  async paymentSent(sellerId: number, orderId: number, etb: string) {
    const tgId = await getTgId(sellerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `💰 *Buyer Marked Payment Sent!*\n\nAmount: \`Br ${etb}\`\n\n✅ Please verify payment then release crypto.`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  async orderCompleted(buyerId: number, orderId: number, usdt: string) {
    const tgId = await getTgId(buyerId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `🎉 *Order Completed!*\n\n\`${usdt} USDT\` has been deposited to your wallet!\n\nThank you for trading on Xendrx 🚀`,
      `${APP_URL}/wallet`
    );
  },

  async orderCancelled(userId: number, orderId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *Order Cancelled*\n\nYour order has been cancelled.\nContact support if you need help.`,
      `${APP_URL}/orders`
    );
  },

  async appealRaised(userId: number, orderId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `⚠️ *Appeal Raised*\n\nAn appeal has been filed on your order.\nAdmin will review and resolve within 24 hours.\nYour funds are safe in Xendrx escrow.`,
      `${APP_URL}/trade/${orderId}`
    );
  },

  async newMessage(userId: number, orderId: number, sender: string, preview: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `💬 *New Message from ${sender}*\n\n"${preview.slice(0, 80)}${preview.length > 80 ? "..." : ""}"`,
      `${APP_URL}/chat/${orderId}`
    );
  },

  async kycApproved(userId: number) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `✅ *Identity Verified!*\n\nYour KYC has been approved!\nYou can now trade on Xendrx 🚀`,
      `${APP_URL}/p2p`
    );
  },

  async kycRejected(userId: number, reason: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *KYC Rejected*\n\nReason: ${reason}\n\nPlease resubmit with correct documents.`,
      `${APP_URL}/kyc`
    );
  },

  async withdrawalApproved(userId: number, amount: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `✅ *Withdrawal Approved*\n\n\`${amount} USDT\` withdrawal is being processed.\nFunds will arrive within 30 minutes.`,
      `${APP_URL}/wallet`
    );
  },

  async withdrawalRejected(userId: number, amount: string, reason: string) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      `❌ *Withdrawal Rejected*\n\nAmount: \`${amount} USDT\`\nReason: ${reason}\n\nFunds returned to your wallet.`,
      `${APP_URL}/wallet`
    );
  },

  async appealResolved(userId: number, orderId: number, won: boolean) {
    const tgId = await getTgId(userId);
    if (!tgId) return;
    await sendTelegramMessage(
      tgId,
      won
        ? `✅ *Appeal Resolved — You Won!*\n\nFunds have been released to your wallet.`
        : `❌ *Appeal Resolved*\n\nThe appeal was decided in favor of the counterparty.`,
      `${APP_URL}/orders`
    );
  },
};
