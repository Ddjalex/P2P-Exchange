import { db } from "@workspace/db";

const SEEDED_EMAILS = [
  "alem@xendrx.com",
  "biruk@xendrx.com",
  "sara@xendrx.com",
  "yonas@xendrx.com",
  "tigist@xendrx.com",
  // legacy emails (pre-rebrand)
  "alem@xendrx.com",
  "biruk@xendrx.com",
  "sara@xendrx.com",
  "yonas@xendrx.com",
  "tigist@xendrx.com",
];

async function cleanup() {
  console.log("🧹 Cleaning up seeded demo data...");
  const pool = (db as any).$client;
  const client = await pool.connect();

  try {
    const emailList = SEEDED_EMAILS.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: seededUsers } = await client.query(
      `SELECT id, username, email FROM users WHERE email IN (${emailList})`,
      SEEDED_EMAILS
    );

    if (seededUsers.length === 0) {
      console.log("✅ No seeded demo users found — database is already clean.");
      return;
    }

    const ids: number[] = seededUsers.map((u: any) => u.id);
    const idList = ids.map((_, i) => `$${i + 1}`).join(", ");
    console.log(`Found ${ids.length} seeded user(s):`, seededUsers.map((u: any) => u.username));

    await client.query("BEGIN");

    // Delete child records in dependency order
    const q = async (sql: string, params?: any[]) => {
      const r = await client.query(sql, params);
      return r.rowCount ?? 0;
    };

    // messages can reference orders, delete by sender_id first then by order
    await q(`DELETE FROM messages WHERE sender_id IN (${idList})`, ids);

    // orders - buyer or seller (use same placeholders, pg accepts repeated refs)
    const { rows: seededOrders } = await client.query(
      `SELECT id FROM orders WHERE buyer_id IN (${idList}) OR seller_id IN (${idList})`,
      ids
    );
    if (seededOrders.length > 0) {
      const orderIds = seededOrders.map((o: any) => o.id);
      const orderList = orderIds.map((_: any, i: number) => `$${i + 1}`).join(", ");
      await q(`DELETE FROM messages WHERE order_id IN (${orderList})`, orderIds);
      await q(`DELETE FROM appeals WHERE order_id IN (${orderList})`, orderIds);
      await q(`DELETE FROM orders WHERE id IN (${orderList})`, orderIds);
      console.log(`  orders deleted: ${seededOrders.length}`);
    }

    const tables: Array<{ table: string; col: string }> = [
      { table: "ads", col: "user_id" },
      { table: "notifications", col: "user_id" },
      { table: "kyc_submissions", col: "user_id" },
      { table: "transactions", col: "user_id" },
      { table: "wallets", col: "user_id" },
      { table: "payment_methods", col: "user_id" },
      { table: "feedback", col: "from_user_id" },
      { table: "fraud_flags", col: "user_id" },
    ];

    for (const { table, col } of tables) {
      const n = await q(`DELETE FROM ${table} WHERE ${col} IN (${idList})`, ids);
      if (n > 0) console.log(`  ${table} deleted: ${n}`);
    }

    const n = await q(`DELETE FROM users WHERE id IN (${idList})`, ids);
    console.log(`  users deleted: ${n}`);

    await client.query("COMMIT");
    console.log("✅ All seeded demo data removed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  process.exit(0);
}

cleanup().catch(e => {
  console.error("❌ Cleanup failed:", e.message);
  process.exit(1);
});
