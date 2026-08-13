-- Create the complete Keno schema and seed its default configuration.
-- All statements are idempotent so this repairs databases that were
-- provisioned by an earlier schema push without replacing existing data.

CREATE TABLE IF NOT EXISTS "keno_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL UNIQUE,
	"real_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"demo_balance" numeric(12, 2) DEFAULT '10000.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" text NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_paytable" (
	"id" serial PRIMARY KEY NOT NULL,
	"picks" integer NOT NULL,
	"hits" integer NOT NULL,
	"multiplier" numeric(10, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "keno_paytable_picks_hits" UNIQUE("picks","hits")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"mode" text NOT NULL,
	"drawn_numbers" jsonb,
	"entropy_data" text,
	"total_staked" numeric(14, 2) NOT NULL,
	"total_payout" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"ticket_count" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"round_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"mode" text NOT NULL,
	"batch_id" integer,
	"picks" jsonb NOT NULL,
	"drawn_numbers" jsonb NOT NULL,
	"bet_amount" numeric(12, 2) NOT NULL,
	"hit_count" integer NOT NULL,
	"multiplier" numeric(10, 4) NOT NULL,
	"payout_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_draws" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL UNIQUE,
	"drawn_numbers" jsonb NOT NULL,
	"server_seed" text NOT NULL,
	"server_hash" text NOT NULL,
	"seed_timestamp" timestamp NOT NULL,
	"draw_timestamp" timestamp NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keno_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keno_draws_round_id_idx"
	ON "keno_draws" ("round_id" DESC);
--> statement-breakpoint

INSERT INTO "keno_paytable" ("picks", "hits", "multiplier") VALUES
	(1, 0, '0'),
	(1, 1, '3.2000'),
	(2, 0, '0'),
	(2, 1, '0'),
	(2, 2, '13.3100'),
	(3, 0, '0'),
	(3, 1, '0'),
	(3, 2, '1.0000'),
	(3, 3, '25.5000'),
	(4, 0, '0'),
	(4, 1, '0'),
	(4, 2, '1.6800'),
	(4, 3, '6.7000'),
	(4, 4, '50.2500'),
	(5, 0, '0'),
	(5, 1, '0'),
	(5, 2, '0'),
	(5, 3, '4.5300'),
	(5, 4, '22.6500'),
	(5, 5, '226.5000'),
	(6, 0, '0'),
	(6, 1, '0'),
	(6, 2, '0'),
	(6, 3, '1.8600'),
	(6, 4, '9.3100'),
	(6, 5, '55.8000'),
	(6, 6, '930.0000'),
	(7, 0, '0'),
	(7, 1, '0'),
	(7, 2, '0'),
	(7, 3, '0'),
	(7, 4, '5.6400'),
	(7, 5, '28.2000'),
	(7, 6, '169.0000'),
	(7, 7, '5645.0000'),
	(8, 0, '0'),
	(8, 1, '0'),
	(8, 2, '0'),
	(8, 3, '0'),
	(8, 4, '2.8000'),
	(8, 5, '14.0000'),
	(8, 6, '69.9000'),
	(8, 7, '559.0000'),
	(8, 8, '13985.0000'),
	(9, 0, '0'),
	(9, 1, '0'),
	(9, 2, '0'),
	(9, 3, '0'),
	(9, 4, '0'),
	(9, 5, '8.4700'),
	(9, 6, '42.3000'),
	(9, 7, '254.0000'),
	(9, 8, '2540.0000'),
	(9, 9, '67720.0000'),
	(10, 0, '0'),
	(10, 1, '0'),
	(10, 2, '0'),
	(10, 3, '0'),
	(10, 4, '0'),
	(10, 5, '7.2400'),
	(10, 6, '21.7200'),
	(10, 7, '72.4000'),
	(10, 8, '362.0000'),
	(10, 9, '1448.0000'),
	(10, 10, '36200.0000')
ON CONFLICT ("picks", "hits") DO NOTHING;
--> statement-breakpoint
INSERT INTO "keno_settings" ("key", "value") VALUES
	('game_enabled', 'true'),
	('min_bet', '0.10'),
	('max_bet', '100.00'),
	('min_topup', '1.00'),
	('max_topup', '1000.00'),
	('house_edge', '0.20')
ON CONFLICT ("key") DO NOTHING;
