ALTER TABLE "users" ADD COLUMN "withdrawal_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "withdrawal_suspend_reason" text;