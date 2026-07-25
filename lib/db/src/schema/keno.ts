import { pgTable, serial, integer, text, timestamp, numeric, jsonb, unique } from "drizzle-orm/pg-core";

// ─── Keno Game Wallet ─────────────────────────────────────────────────────────
export const kenoWalletsTable = pgTable("keno_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  realBalance: numeric("real_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  demoBalance: numeric("demo_balance", { precision: 12, scale: 2 }).notNull().default("10000.00"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Keno Transactions (top-up, withdraw, bet, payout) ───────────────────────
export const kenoTransactionsTable = pgTable("keno_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),        // topup | withdraw | bet | payout
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  mode: text("mode").notNull(),        // demo | real
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Admin-configurable payout multipliers ───────────────────────────────────
// picks = number of spots the player chose (1-10)
// hits  = how many of those matched the draw
// multiplier = payout = betAmount * multiplier (0 = no payout)
export const kenoPaytableTable = pgTable("keno_paytable", {
  id: serial("id").primaryKey(),
  picks: integer("picks").notNull(),
  hits: integer("hits").notNull(),
  multiplier: numeric("multiplier", { precision: 10, scale: 4 }).notNull().default("0"),
}, (t) => [unique("keno_paytable_picks_hits").on(t.picks, t.hits)]);

// ─── Individual game rounds ───────────────────────────────────────────────────
export const kenoRoundsTable = pgTable("keno_rounds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mode: text("mode").notNull(),
  picks: jsonb("picks").$type<number[]>().notNull(),
  drawnNumbers: jsonb("drawn_numbers").$type<number[]>().notNull(),
  betAmount: numeric("bet_amount", { precision: 12, scale: 2 }).notNull(),
  hitCount: integer("hit_count").notNull(),
  multiplier: numeric("multiplier", { precision: 10, scale: 4 }).notNull(),
  payoutAmount: numeric("payout_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Game settings (min_bet, max_bet, game_enabled, min_topup, max_topup) ────
export const kenoSettingsTable = pgTable("keno_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type KenoWallet = typeof kenoWalletsTable.$inferSelect;
export type KenoTransaction = typeof kenoTransactionsTable.$inferSelect;
export type KenoPaytableEntry = typeof kenoPaytableTable.$inferSelect;
export type KenoRound = typeof kenoRoundsTable.$inferSelect;
