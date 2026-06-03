import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appealStatusEnum = pgEnum("appeal_status", ["pending", "resolved"]);

export const appealsTable = pgTable("appeals", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  raisedBy: integer("raised_by").notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidenceUrls: text("evidence_urls").notNull().default("[]"),
  status: appealStatusEnum("status").notNull().default("pending"),
  adminDecision: text("admin_decision"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAppealSchema = createInsertSchema(appealsTable).omit({ id: true, createdAt: true });
export type InsertAppeal = z.infer<typeof insertAppealSchema>;
export type Appeal = typeof appealsTable.$inferSelect;
