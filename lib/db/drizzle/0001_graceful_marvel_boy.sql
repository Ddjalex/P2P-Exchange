CREATE TABLE "telegram_link_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" varchar(10) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_link_codes_code_unique" UNIQUE("code")
);
