import { pgTable, serial, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kycStatusEnum = pgEnum("kyc_status", ["none", "pending", "verified", "rejected", "more_info_required"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  country: text("country").notNull().default("Ethiopia"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("none"),
  isMerchant: boolean("is_merchant").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  smsVerified: boolean("sms_verified").notNull().default(false),
  addressVerified: boolean("address_verified").notNull().default(false),
  notificationSettings: text("notification_settings").notNull().default('{"tradeAlerts":true,"chatMessages":true,"systemNotifications":true,"emailNotifications":true,"smsNotifications":false}'),
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspensionReason: text("suspension_reason"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
