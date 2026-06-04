import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL is not set. Set it to your Neon PostgreSQL connection string.",
  );
}

export const pool = new Pool({ connectionString });

pool.on("connect", (client) => {
  client.query("SET search_path = public");
});

export const db = drizzle(pool, { schema });

export * from "./schema";
