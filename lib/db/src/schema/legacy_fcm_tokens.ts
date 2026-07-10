import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";

// Legacy table kept for backwards compatibility with existing data; not used
// by current app logic but preserved so schema pushes don't drop it.
export const fcmTokensTable = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  token: text("token").unique(),
  platform: varchar("platform", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FcmToken = typeof fcmTokensTable.$inferSelect;
