import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platformWalletTable = pgTable("platform_wallet", {
  id: serial("id").primaryKey(),
  asset: text("asset").notNull().default("USDT"),
  totalCollected: numeric("total_collected", { precision: 20, scale: 8 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformWalletSchema = createInsertSchema(platformWalletTable).omit({ id: true, updatedAt: true });
export type InsertPlatformWallet = z.infer<typeof insertPlatformWalletSchema>;
export type PlatformWallet = typeof platformWalletTable.$inferSelect;
