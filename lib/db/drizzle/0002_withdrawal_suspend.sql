ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "withdrawal_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "withdrawal_suspend_reason" text;
