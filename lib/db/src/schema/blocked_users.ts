import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const blockedUsersTable = pgTable("blocked_users", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull(),
  blockedId: integer("blocked_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.blockerId, t.blockedId)]);

export type BlockedUser = typeof blockedUsersTable.$inferSelect;
