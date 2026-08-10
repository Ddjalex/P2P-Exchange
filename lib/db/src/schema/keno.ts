import { pgTable, serial, integer, text, timestamp, numeric, jsonb, unique, boolean } from "drizzle-orm/pg-core";

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

// ─── Multi-ticket Batch ───────────────────────────────────────────────────────
// One row per user submission (1–10 tickets sharing a single draw).
// For instant-play batches: drawnNumbers + entropyData are set at creation.
// For multiplayer batches:  roundId links to the shared round_id; both
//   drawnNumbers and entropyData are populated at settlement time.
//
// status lifecycle:  pending → settled  (normal)
//                    pending → refunded (error recovery)
export const kenoBatchesTable = pgTable("keno_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mode: text("mode").notNull(),                      // "demo" | "real"
  drawnNumbers: jsonb("drawn_numbers").$type<number[]>(),
  entropyData: text("entropy_data"),                 // SHA-256(raw_nonce) for provability
  totalStaked: numeric("total_staked", { precision: 14, scale: 2 }).notNull(),
  totalPayout: numeric("total_payout", { precision: 14, scale: 2 }).notNull().default("0.00"),
  ticketCount: integer("ticket_count").notNull(),
  status: text("status").notNull().default("pending"), // pending | settled | refunded
  roundId: integer("round_id"),                      // null=instant; set=multiplayer shared round
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

// ─── Individual game rounds (tickets) ────────────────────────────────────────
// batchId links to keno_batches; null for legacy single-ticket records.
export const kenoRoundsTable = pgTable("keno_rounds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mode: text("mode").notNull(),
  batchId: integer("batch_id"),                      // FK → keno_batches (null = legacy)
  picks: jsonb("picks").$type<number[]>().notNull(),
  drawnNumbers: jsonb("drawn_numbers").$type<number[]>().notNull(),
  betAmount: numeric("bet_amount", { precision: 12, scale: 2 }).notNull(),
  hitCount: integer("hit_count").notNull(),
  multiplier: numeric("multiplier", { precision: 10, scale: 4 }).notNull(),
  payoutAmount: numeric("payout_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Global draw log — one row per completed multiplayer round ────────────────
// Persisted regardless of whether any user placed a bet.
// This is the source of truth for the Results / drawn-numbers history UI.
export const kenoDrawsTable = pgTable("keno_draws", {
  id:                 serial("id").primaryKey(),
  roundId:            integer("round_id").notNull().unique(),
  drawnNumbers:       jsonb("drawn_numbers").$type<number[]>().notNull(),
  serverSeed:         text("server_seed").notNull(),         // revealed after draw
  serverHash:         text("server_hash").notNull(),         // committed before betting
  seedTimestamp:      timestamp("seed_timestamp").notNull(),
  drawTimestamp:      timestamp("draw_timestamp").notNull(),
  participantCount:   integer("participant_count").notNull().default(0),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
  // ── Pool/pari-mutuel financial snapshot (locked at round start) ──────────
  houseMarginPercent: numeric("house_margin_percent", { precision: 5, scale: 2 }),
  grossPool:          numeric("gross_pool", { precision: 14, scale: 2 }),
  ownerProfitAllocation: numeric("owner_profit_allocation", { precision: 14, scale: 2 }),
  prizeBudget:        numeric("prize_budget", { precision: 14, scale: 2 }),
  totalPrizesPaid:    numeric("total_prizes_paid", { precision: 14, scale: 2 }),
  unclaimedAmount:    numeric("unclaimed_amount", { precision: 14, scale: 2 }),
  confirmedEntries:   integer("confirmed_entries"),
});

// ─── Game settings (min_bet, max_bet, game_enabled, min_topup, max_topup) ────
export const kenoSettingsTable = pgTable("keno_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type KenoWallet        = typeof kenoWalletsTable.$inferSelect;
export type KenoTransaction   = typeof kenoTransactionsTable.$inferSelect;
export type KenoPaytableEntry = typeof kenoPaytableTable.$inferSelect;
export type KenoRound         = typeof kenoRoundsTable.$inferSelect;
export type KenoBatch         = typeof kenoBatchesTable.$inferSelect;
