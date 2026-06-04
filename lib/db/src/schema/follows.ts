import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followedId: integer("followed_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.followerId, t.followedId)]);

export type Follow = typeof followsTable.$inferSelect;
