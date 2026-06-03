import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const fraudFlagsTable = pgTable("fraud_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  flagType: text("flag_type").notNull(), // 'appeal_loss' | 'high_cancellation' | 'negative_feedback' | 'manual'
  description: text("description"),
  flaggedBy: text("flagged_by").notNull().default("system"), // 'system' | 'admin'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FraudFlag = typeof fraudFlagsTable.$inferSelect;
