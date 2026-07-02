import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";

export const telegramLinkCodesTable = pgTable("telegram_link_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  code: varchar("code", { length: 10 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("telegram_link_codes_code_unique").on(t.code)]);

export type TelegramLinkCode = typeof telegramLinkCodesTable.$inferSelect;
