import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Legacy table kept for backwards compatibility with existing data; not used
// by current app logic but preserved so schema pushes don't drop it.
export const appConfigTable = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AppConfig = typeof appConfigTable.$inferSelect;
