import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  subscription: text("subscription").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
