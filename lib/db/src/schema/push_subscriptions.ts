import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  subscription: text("subscription"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Legacy columns predating the current `subscription` JSON blob approach;
  // not used by current app logic but preserved so schema pushes don't drop them.
  p256dh: text("p256dh"),
  auth: text("auth"),
  userAgent: text("user_agent"),
  lastUsedAt: timestamp("last_used_at"),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
