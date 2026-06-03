import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adTypeEnum = pgEnum("ad_type", ["buy", "sell"]);
export const priceTypeEnum = pgEnum("price_type", ["fixed", "floating"]);
export const adStatusEnum = pgEnum("ad_status", ["online", "offline", "private"]);

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: adTypeEnum("type").notNull(),
  asset: text("asset").notNull().default("USDT"),
  fiat: text("fiat").notNull().default("ETB"),
  priceType: priceTypeEnum("price_type").notNull().default("fixed"),
  price: text("price").notNull(),
  floatingMargin: text("floating_margin"),
  totalAmount: text("total_amount").notNull(),
  availableAmount: text("available_amount").notNull(),
  minLimit: text("min_limit").notNull(),
  maxLimit: text("max_limit").notNull(),
  paymentMethods: text("payment_methods").notNull().default("[]"),
  paymentTimeLimit: integer("payment_time_limit").notNull().default(15),
  autoReply: text("auto_reply"),
  conditions: text("conditions").notNull().default("{}"),
  region: text("region").notNull().default("Ethiopia Only"),
  status: adStatusEnum("status").notNull().default("online"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdSchema = createInsertSchema(adsTable).omit({ id: true, createdAt: true });
export type InsertAd = z.infer<typeof insertAdSchema>;
export type Ad = typeof adsTable.$inferSelect;
