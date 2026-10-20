import { defineConfig } from "drizzle-kit";

/**
 * Per-slot Drizzle configuration. Migrations only ever touch this slot's
 * schema. Usage (from the repo root):
 *   npm run slot:db -- --slot 5 --cmd generate
 *   npm run slot:db -- --slot 5 --cmd push
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  schemaFilter: ["slot_000005"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
