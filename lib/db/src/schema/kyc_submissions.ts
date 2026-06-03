import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kycSubmissionStatusEnum = pgEnum("kyc_submission_status", ["pending", "verified", "rejected", "more_info_required"]);
export const idTypeEnum = pgEnum("id_type", ["national_id", "passport", "drivers_license", "kebele_id"]);

export const kycSubmissionsTable = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nationality: text("nationality").notNull(),
  idType: idTypeEnum("id_type").notNull(),
  frontImageUrl: text("front_image_url").notNull(),
  backImageUrl: text("back_image_url"),
  selfieUrl: text("selfie_url").notNull(),
  livenessResult: text("liveness_result").notNull().default("{}"),
  status: kycSubmissionStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  adminMessage: text("admin_message"),
  reviewedBy: integer("reviewed_by"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertKycSubmissionSchema = createInsertSchema(kycSubmissionsTable).omit({ id: true, submittedAt: true });
export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;
export type KycSubmission = typeof kycSubmissionsTable.$inferSelect;
