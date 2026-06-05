import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feeTransactionsTable = pgTable("fee_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"),
  userId: integer("user_id"),
  feeType: text("fee_type").notNull(),
  feePercent: numeric("fee_percent", { precision: 10, scale: 4 }).notNull(),
  grossAmount: numeric("gross_amount", { precision: 20, scale: 8 }).notNull(),
  feeAmount: numeric("fee_amount", { precision: 20, scale: 8 }).notNull(),
  netAmount: numeric("net_amount", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeeTransactionSchema = createInsertSchema(feeTransactionsTable).omit({ id: true, createdAt: true });
export type InsertFeeTransaction = z.infer<typeof insertFeeTransactionSchema>;
export type FeeTransaction = typeof feeTransactionsTable.$inferSelect;
