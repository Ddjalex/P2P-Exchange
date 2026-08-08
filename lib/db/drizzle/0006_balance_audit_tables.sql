-- Add balance and card-queue audit tables used to verify administrative refunds.
-- These objects already exist in the live database; this migration keeps fresh
-- database setups aligned without affecting existing installations.

CREATE TABLE IF NOT EXISTS "wallet_balance_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "old_available" numeric,
  "new_available" numeric,
  "old_frozen" numeric,
  "new_frozen" numeric,
  "changed_at" timestamp DEFAULT now() NOT NULL,
  "app_user" text,
  "client_addr" text,
  "consumed_by_queue_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_queue_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "queue_id" integer NOT NULL,
  "user_id" integer,
  "old_status" text,
  "new_status" text,
  "old_amount" text,
  "new_amount" text,
  "attempts" integer,
  "error_message" text,
  "changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;