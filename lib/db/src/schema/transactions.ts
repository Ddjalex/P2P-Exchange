import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const txTypeEnum = pgEnum("tx_type", ["deposit", "withdraw", "transfer", "p2p_buy", "p2p_sell"]);
export const txStatusEnum = pgEnum("tx_status", ["pending", "completed", "failed"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: txTypeEnum("type").notNull(),
  amount: text("amount").notNull(),
  network: text("network"),
  status: txStatusEnum("status").notNull().default("pending"),
  txid: text("txid"),
  address: text("address"),
  fee: text("fee"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
