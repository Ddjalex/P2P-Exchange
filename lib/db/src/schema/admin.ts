import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemSettingsTable = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationHistoryTable = pgTable("notification_history", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  target: text("target").notNull(),
  channel: text("channel").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  recipientCount: integer("recipient_count").notNull().default(0),
  status: text("status").notNull().default("sent"),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;
export type NotificationHistory = typeof notificationHistoryTable.$inferSelect;
