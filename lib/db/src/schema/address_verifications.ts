import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const addressVerificationsTable = pgTable("address_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).unique().notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  addressLine1: varchar("address_line1", { length: 255 }).notNull(),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  documentImageUrl: text("document_image_url").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export type AddressVerification = typeof addressVerificationsTable.$inferSelect;
