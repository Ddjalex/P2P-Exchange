import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// type is now plain text to support 800+ global payment methods (Binance P2P style)
// country is ISO 3166-1 alpha-2 code, e.g. "ET", "NG", "US"
export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  country: text("country").notNull().default("ET"),
  type: text("type").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({ id: true, createdAt: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
