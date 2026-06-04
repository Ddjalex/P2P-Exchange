import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL is not set. Set it to your Neon PostgreSQL connection string.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
