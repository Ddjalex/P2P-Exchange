import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", ["unpaid", "paid", "completed", "cancelled", "appeal"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  amountUsdt: text("amount_usdt").notNull(),
  amountEtb: text("amount_etb").notNull(),
  price: text("price").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentTimeLimit: integer("payment_time_limit").notNull().default(15),
  status: orderStatusEnum("status").notNull().default("unpaid"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
  completedAt: timestamp("completed_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
