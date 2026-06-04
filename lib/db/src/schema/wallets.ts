import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  asset: text("asset").notNull().default("USDT"),
  availableBalance: text("available_balance").notNull().default("0.00"),
  frozenBalance: text("frozen_balance").notNull().default("0.00"),
  depositAddress: text("deposit_address"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
