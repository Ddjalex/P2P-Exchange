import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Legacy table kept for backwards compatibility with existing data; not used
// by current app logic but preserved so schema pushes don't drop it.
export const legacyPendingRegistrationsTable = pgTable("pending_registrations", {
  id: serial("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  passwordHash: text("password_hash"),
  code: text("code"),
  expiresAt: timestamp("expires_at"),
  used: boolean("used"),
  createdAt: timestamp("created_at").defaultNow(),
  age: text("age"),
  sex: text("sex"),
  referralCode: text("referral_code"),
});

export type LegacyPendingRegistration = typeof legacyPendingRegistrationsTable.$inferSelect;
