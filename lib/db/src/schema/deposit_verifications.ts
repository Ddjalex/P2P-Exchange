import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const depositVerificationsTable = pgTable("deposit_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  txid: text("txid").notNull().unique(),
  amount: text("amount"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  network: text("network").notNull().default("TRC20"),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("user_report"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DepositVerification = typeof depositVerificationsTable.$inferSelect;
