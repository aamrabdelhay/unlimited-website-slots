import { pgSchema, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Meridian Studio — every table lives exclusively in the `slot_000001`
 * PostgreSQL schema. In shared-database mode this schema is the only one
 * this slot can touch, and it is derived from the slot id server-side.
 */
export const slotSchema = pgSchema("slot_000001");

export const messages = slotSchema.table("messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  email: varchar("email", { length: 120 }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MessageRow = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
