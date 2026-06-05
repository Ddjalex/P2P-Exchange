import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cardWaitlistTable = pgTable("card_waitlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  username: text("username"),
  email: text("email"),
  kycName: text("kyc_name"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type CardWaitlist = typeof cardWaitlistTable.$inferSelect;
