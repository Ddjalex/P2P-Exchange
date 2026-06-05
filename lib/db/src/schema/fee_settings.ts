import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feeSettingsTable = pgTable("fee_settings", {
  id: serial("id").primaryKey(),
  feeType: text("fee_type").notNull().unique(),
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeeSettingSchema = createInsertSchema(feeSettingsTable).omit({ id: true, updatedAt: true });
export type InsertFeeSetting = z.infer<typeof insertFeeSettingSchema>;
export type FeeSetting = typeof feeSettingsTable.$inferSelect;
