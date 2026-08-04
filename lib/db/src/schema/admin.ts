import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const adminEmailSendsTable = pgTable("admin_email_sends", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  userId: integer("user_id"),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("sent"),
  error: text("error"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  note: text("note"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit table — tracks every wallet balance change (trigger-populated on prod)
export const walletBalanceAuditTable = pgTable("wallet_balance_audit", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  oldAvailable: numeric("old_available"),
  newAvailable: numeric("new_available"),
  oldFrozen: numeric("old_frozen"),
  newFrozen: numeric("new_frozen"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  appUser: text("app_user"),
  clientAddr: text("client_addr"),
  consumedByQueueId: integer("consumed_by_queue_id"),
});

// Audit table — tracks card queue status changes
export const cardQueueAuditTable = pgTable("card_queue_audit", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull(),
  userId: integer("user_id"),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  oldAmount: text("old_amount"),
  newAmount: text("new_amount"),
  attempts: integer("attempts"),
  errorMessage: text("error_message"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
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
export type WalletBalanceAudit = typeof walletBalanceAuditTable.$inferSelect;
export type CardQueueAudit = typeof cardQueueAuditTable.$inferSelect;
