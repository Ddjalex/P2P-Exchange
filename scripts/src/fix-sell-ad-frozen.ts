/**
 * One-time fix: find sell ads where the USDT was never frozen in the wallet,
 * and move the missing amount from availableBalance → frozenBalance.
 * Safe to run multiple times (idempotent).
 */
import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    // 1. Fetch all sell ads with their owner's wallet
    const { rows: sellAds } = await client.query<{
      ad_id: number;
      user_id: number;
      status: string;
      total_amount: string;
      available_amount: string;
      wallet_available: string;
      wallet_frozen: string;
    }>(`
      SELECT
        a.id            AS ad_id,
        a.user_id,
        a.status,
        a.total_amount,
        a.available_amount,
        w.available_balance AS wallet_available,
        w.frozen_balance    AS wallet_frozen
      FROM ads a
      JOIN wallets w ON w.user_id = a.user_id
      WHERE a.type = 'sell'
      ORDER BY a.user_id, a.id
    `);

    if (sellAds.length === 0) {
      console.log("No sell ads found — nothing to fix.");
      return;
    }

    // 2. Aggregate expected frozen per user (sum of totalAmount across their sell ads)
    const byUser: Record<number, {
      expectedFrozen: number;
      adIds: number[];
      walletAvailable: number;
      walletFrozen: number;
    }> = {};

    for (const row of sellAds) {
      const uid = row.user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          expectedFrozen: 0,
          adIds: [],
          walletAvailable: parseFloat(row.wallet_available),
          walletFrozen: parseFloat(row.wallet_frozen),
        };
      }
      byUser[uid].expectedFrozen += parseFloat(row.total_amount);
      byUser[uid].adIds.push(row.ad_id);
    }

    console.log("\n── Sell-ad frozen balance diagnostic ────────────────────────");

    for (const [userIdStr, data] of Object.entries(byUser)) {
      const userId = Number(userIdStr);
      const { expectedFrozen, adIds, walletAvailable, walletFrozen } = data;
      const deficit = Math.max(0, expectedFrozen - walletFrozen);

      console.log(`\nUser ${userId}  adIds=${JSON.stringify(adIds)}`);
      console.log(`  Expected frozen (sum of sell-ad totalAmounts): ${expectedFrozen.toFixed(4)} USDT`);
      console.log(`  Actual   frozen:                               ${walletFrozen.toFixed(4)} USDT`);
      console.log(`  Available:                                     ${walletAvailable.toFixed(4)} USDT`);
      console.log(`  Deficit:                                       ${deficit.toFixed(4)} USDT`);

      if (deficit < 0.0001) {
        console.log(`  ✅ Already correct — no fix needed`);
        continue;
      }

      const toFreeze = Math.min(deficit, walletAvailable);
      if (toFreeze < 0.0001) {
        console.log(`  ⚠ No available balance to freeze — skipping`);
        continue;
      }

      const newAvailable = Math.max(0, walletAvailable - toFreeze);
      const newFrozen = walletFrozen + toFreeze;

      await client.query(
        `UPDATE wallets
         SET available_balance = $1, frozen_balance = $2
         WHERE user_id = $3`,
        [newAvailable.toFixed(4), newFrozen.toFixed(4), userId]
      );

      console.log(`  🔒 Fixed — moved ${toFreeze.toFixed(4)} USDT from available → frozen`);
      console.log(`  New available: ${newAvailable.toFixed(4)}  new frozen: ${newFrozen.toFixed(4)}`);
    }

    console.log("\n── Done ──────────────────────────────────────────────────────\n");
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

main().catch(err => {
  console.error("Fix failed:", err);
  process.exit(1);
});
