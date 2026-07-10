import { pgTable, serial, text, boolean, timestamp, integer, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kycStatusEnum = pgEnum("kyc_status", ["none", "pending", "verified", "rejected", "more_info_required"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").unique(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  country: text("country").notNull().default("Ethiopia"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("none"),
  isMerchant: boolean("is_merchant").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  smsVerified: boolean("sms_verified").notNull().default(false),
  addressVerified: boolean("address_verified").notNull().default(false),
  addressVerifiedAt: timestamp("address_verified_at"),
  notificationSettings: text("notification_settings").notNull().default('{"tradeAlerts":true,"chatMessages":true,"systemNotifications":true,"emailNotifications":true,"smsNotifications":false}'),
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspensionReason: text("suspension_reason"),
  suspendedUntil: timestamp("suspended_until"),
  suspendedAt: timestamp("suspended_at"),
  isFrozen: boolean("is_frozen").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  freezeReason: text("freeze_reason"),
  frozenAt: timestamp("frozen_at"),
  flagCount: integer("flag_count").notNull().default(0),
  cancellationCount7d: integer("cancellation_count_7d").notNull().default(0),
  appealLossCount30d: integer("appeal_loss_count_30d").notNull().default(0),
  withdrawalSuspended: boolean("withdrawal_suspended").notNull().default(false),
  withdrawalSuspendReason: text("withdrawal_suspend_reason"),
  passwordHash: text("password_hash"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Legacy columns kept for backwards compatibility with existing data; not
  // used by current app logic but preserved so schema pushes don't drop them.
  name: text("name"),
  role: text("role").notNull().default("user"),
  balance: numeric("balance").notNull().default("0"),
  age: text("age"),
  sex: text("sex"),
  avatarUrl: text("avatar_url"),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
