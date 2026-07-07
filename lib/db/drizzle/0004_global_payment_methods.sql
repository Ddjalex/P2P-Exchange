-- Migrate payment_methods.type from enum to text, add country column
-- This enables 800+ global payment methods (like Binance P2P) instead of only Ethiopian ones

-- Step 1: add country column (default ET = Ethiopia, preserving existing rows)
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "country" text NOT NULL DEFAULT 'ET';

-- Step 2: convert type column from enum to text
ALTER TABLE "payment_methods" ALTER COLUMN "type" TYPE text;

-- Step 3: drop the old enum type (now unused)
DROP TYPE IF EXISTS "payment_method_type";
