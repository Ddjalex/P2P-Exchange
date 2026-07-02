CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected', 'more_info_required');--> statement-breakpoint
CREATE TYPE "public"."tx_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('deposit', 'withdraw', 'transfer', 'p2p_buy', 'p2p_sell', 'internal_send', 'internal_receive');--> statement-breakpoint
CREATE TYPE "public"."ad_status" AS ENUM('online', 'offline', 'private');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."price_type" AS ENUM('fixed', 'floating');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('unpaid', 'paid', 'completed', 'cancelled', 'appeal');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'system', 'admin');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('CBE', 'Telebirr', 'Awash', 'Dashen', 'Abyssinia', 'HelloCash', 'MPesa');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('positive', 'negative');--> statement-breakpoint
CREATE TYPE "public"."id_type" AS ENUM('national_id', 'passport', 'drivers_license', 'kebele_id');--> statement-breakpoint
CREATE TYPE "public"."kyc_submission_status" AS ENUM('pending', 'verified', 'rejected', 'more_info_required');--> statement-breakpoint
CREATE TYPE "public"."appeal_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"country" text DEFAULT 'Ethiopia' NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"is_merchant" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"sms_verified" boolean DEFAULT false NOT NULL,
	"address_verified" boolean DEFAULT false NOT NULL,
	"address_verified_at" timestamp,
	"notification_settings" text DEFAULT '{"tradeAlerts":true,"chatMessages":true,"systemNotifications":true,"emailNotifications":true,"smsNotifications":false}' NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"suspension_reason" text,
	"suspended_until" timestamp,
	"suspended_at" timestamp,
	"is_frozen" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"freeze_reason" text,
	"frozen_at" timestamp,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"cancellation_count_7d" integer DEFAULT 0 NOT NULL,
	"appeal_loss_count_30d" integer DEFAULT 0 NOT NULL,
	"password_hash" text,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"asset" text DEFAULT 'USDT' NOT NULL,
	"available_balance" text DEFAULT '0.00' NOT NULL,
	"frozen_balance" text DEFAULT '0.00' NOT NULL,
	"deposit_address" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "tx_type" NOT NULL,
	"amount" text NOT NULL,
	"network" text,
	"status" "tx_status" DEFAULT 'pending' NOT NULL,
	"txid" text,
	"address" text,
	"fee" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "ad_type" NOT NULL,
	"asset" text DEFAULT 'USDT' NOT NULL,
	"fiat" text DEFAULT 'ETB' NOT NULL,
	"price_type" "price_type" DEFAULT 'fixed' NOT NULL,
	"price" text NOT NULL,
	"floating_margin" text,
	"total_amount" text NOT NULL,
	"available_amount" text NOT NULL,
	"min_limit" text NOT NULL,
	"max_limit" text NOT NULL,
	"payment_methods" text DEFAULT '[]' NOT NULL,
	"payment_time_limit" integer DEFAULT 15 NOT NULL,
	"auto_reply" text,
	"conditions" text DEFAULT '{}' NOT NULL,
	"region" text DEFAULT 'Ethiopia Only' NOT NULL,
	"status" "ad_status" DEFAULT 'online' NOT NULL,
	"pause_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"amount_usdt" text NOT NULL,
	"amount_etb" text NOT NULL,
	"price" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_time_limit" integer DEFAULT 15 NOT NULL,
	"status" "order_status" DEFAULT 'unpaid' NOT NULL,
	"cancel_reason" text,
	"frozen_at" timestamp,
	"released_at" timestamp,
	"appeal_available_at" timestamp,
	"admin_note" text,
	"admin_resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"completed_at" timestamp,
	"maker_fee_percent" numeric(10, 4) DEFAULT '0.20',
	"taker_fee_percent" numeric(10, 4) DEFAULT '0.10',
	"maker_fee_amount" numeric(20, 8) DEFAULT '0',
	"taker_fee_amount" numeric(20, 8) DEFAULT '0',
	"maker_net_amount" numeric(20, 8) DEFAULT '0',
	"taker_net_amount" numeric(20, 8) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_id" integer,
	"receiver_id" integer NOT NULL,
	"content" text NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "payment_method_type" NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"type" "feedback_type" NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"nationality" text NOT NULL,
	"id_type" "id_type" NOT NULL,
	"front_image_url" text NOT NULL,
	"back_image_url" text,
	"selfie_url" text NOT NULL,
	"liveness_result" text DEFAULT '{}' NOT NULL,
	"status" "kyc_submission_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"admin_message" text,
	"reviewed_by" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	CONSTRAINT "kyc_submissions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"raised_by" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"evidence_urls" text DEFAULT '[]' NOT NULL,
	"status" "appeal_status" DEFAULT 'pending' NOT NULL,
	"admin_decision" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"related_order_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"user_id" integer,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" integer,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"flag_type" text NOT NULL,
	"description" text,
	"flagged_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"method" text,
	"telegram_request_id" text
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"followed_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followed_id_unique" UNIQUE("follower_id","followed_id")
);
--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_id" integer NOT NULL,
	"blocked_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_users_blocker_id_blocked_id_unique" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "deposit_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"txid" text NOT NULL,
	"amount" text,
	"from_address" text,
	"to_address" text,
	"network" text DEFAULT 'TRC20' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'user_report' NOT NULL,
	"admin_note" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_verifications_txid_unique" UNIQUE("txid")
);
--> statement-breakpoint
CREATE TABLE "card_waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"username" text,
	"email" text,
	"kyc_name" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_waitlist_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "fee_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_type" text NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fee_settings_fee_type_unique" UNIQUE("fee_type")
);
--> statement-breakpoint
CREATE TABLE "platform_wallet" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset" text DEFAULT 'USDT' NOT NULL,
	"total_collected" numeric(20, 8) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"user_id" integer,
	"fee_type" text NOT NULL,
	"fee_percent" numeric(10, 4) NOT NULL,
	"gross_amount" numeric(20, 8) NOT NULL,
	"fee_amount" numeric(20, 8) NOT NULL,
	"net_amount" numeric(20, 8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_id" varchar(50) NOT NULL,
	"telegram_username" varchar(100),
	"telegram_first_name" varchar(100),
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_users_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"subscription" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "internal_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"amount" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100),
	"country" varchar(100) NOT NULL,
	"postal_code" varchar(20),
	"document_type" varchar(50) NOT NULL,
	"document_image_url" text NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" integer,
	"submitted_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	CONSTRAINT "address_verifications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"token" varchar(6) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"card_id" text,
	"card_user_id" text,
	"customer_id" text,
	"name_on_card" text,
	"card_status" text DEFAULT 'processing' NOT NULL,
	"card_number" text,
	"last4" text,
	"cvv" text,
	"expiry" text,
	"balance" text DEFAULT '0.00' NOT NULL,
	"card_type" text,
	"card_brand" text,
	"reference" text,
	"card_created_date" text,
	"customer_email" text,
	"billing_line1" text DEFAULT 'N/A',
	"billing_city" text DEFAULT 'N/A',
	"billing_state" text DEFAULT 'N/A',
	"billing_postal" text DEFAULT '00000',
	"billing_country" text DEFAULT 'ETH',
	"billing_phone" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cards_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "cards_card_id_unique" UNIQUE("card_id")
);
--> statement-breakpoint
CREATE TABLE "card_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"card_id" text,
	"type" text NOT NULL,
	"amount" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_waitlist" ADD CONSTRAINT "card_waitlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_verifications" ADD CONSTRAINT "address_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;