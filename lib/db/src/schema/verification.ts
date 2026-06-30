import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const verificationCodesTable = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(),
  type: text("type").notNull(),
  code: text("code").notNull(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  method: text("method"),
  telegramRequestId: text("telegram_request_id"),
});

export type VerificationCode = typeof verificationCodesTable.$inferSelect;
