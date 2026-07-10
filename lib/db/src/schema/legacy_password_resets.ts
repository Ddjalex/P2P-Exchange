import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Legacy table kept for backwards compatibility with existing data; distinct
// from password_reset_tokens (the table currently used by the app). Not used
// by current app logic but preserved so schema pushes don't drop it.
export const legacyPasswordResetsTable = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LegacyPasswordReset = typeof legacyPasswordResetsTable.$inferSelect;
