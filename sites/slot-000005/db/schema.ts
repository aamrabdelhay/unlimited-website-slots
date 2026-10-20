import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Every table for this website lives in its own PostgreSQL schema.
 * In shared-database mode this is the ONLY schema this slot may touch.
 */
export const slotSchema = pgSchema("slot_000005");

// Example:
// export const items = slotSchema.table("items", {
//   id: serial("id").primaryKey(),
//   createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
// });
