import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

// Legacy table kept for backwards compatibility with existing data; not used
// by current app logic but preserved so schema pushes don't drop it.
export const languagesTable = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nameAm: text("name_am").notNull().default(""),
  iso: text("iso").notNull(),
  badgeFrom: text("badge_from").notNull().default("#e0e7ff"),
  badgeTo: text("badge_to").notNull().default("#c7d2fe"),
  enabled: boolean("enabled").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Language = typeof languagesTable.$inferSelect;
