import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const telegramUsersTable = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  telegramId: varchar("telegram_id", { length: 50 }).notNull().unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
});

export type TelegramUser = typeof telegramUsersTable.$inferSelect;
