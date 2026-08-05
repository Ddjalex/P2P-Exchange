-- Add keno_draws table to persist every completed multiplayer round,
-- regardless of whether any user placed a bet in that round.
CREATE TABLE IF NOT EXISTS "keno_draws" (
  "id"                 serial PRIMARY KEY,
  "round_id"           integer NOT NULL UNIQUE,
  "drawn_numbers"      jsonb NOT NULL,
  "server_seed"        text NOT NULL,
  "server_hash"        text NOT NULL,
  "seed_timestamp"     timestamp NOT NULL,
  "draw_timestamp"     timestamp NOT NULL,
  "participant_count"  integer NOT NULL DEFAULT 0,
  "created_at"         timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "keno_draws_round_id_idx" ON "keno_draws" ("round_id" DESC);
