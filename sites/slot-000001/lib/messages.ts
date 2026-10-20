import { desc } from "drizzle-orm";
import { z } from "zod";
import { siteDb, hasDatabaseConfig } from "./db";
import { messages, type MessageRow } from "../db/schema";

/**
 * Message store for the Meridian Studio contact form — always scoped to the
 * slot_000001 schema via the tables in db/schema.ts. Degrades honestly when
 * no database is configured instead of pretending to work.
 */

export const messageInputSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(80),
  email: z
    .union([z.literal(""), z.email("Please enter a valid email address.").max(120)])
    .optional()
    .transform((value) => (value ? value : undefined)),
  message: z.string().trim().min(1, "Please write a short note.").max(1000),
  /** Honeypot: must stay empty. Filled-in submissions are spam-dropped. */
  company: z.string().max(40).optional(),
});
export type MessageInput = z.infer<typeof messageInputSchema>;

export type MessageStoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "unconfigured" | "unavailable"; message: string };

/** Latest contact messages, newest first. */
export async function listMessages(limit = 20): Promise<MessageStoreResult<MessageRow[]>> {
  if (!hasDatabaseConfig()) {
    return {
      ok: false,
      code: "unconfigured",
      message: "No database connection configured for this website (DATABASE_URL).",
    };
  }
  try {
    const rows = await siteDb()
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return { ok: true, data: rows };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "The message store is temporarily unavailable.",
    };
  }
}

/** Persist a validated contact message. Returns the new row id. */
export async function createMessage(
  input: MessageInput,
): Promise<MessageStoreResult<{ id: number }>> {
  if (!hasDatabaseConfig()) {
    return {
      ok: false,
      code: "unconfigured",
      message: "No database connection configured for this website (DATABASE_URL).",
    };
  }
  try {
    const [row] = await siteDb()
      .insert(messages)
      .values({ name: input.name, email: input.email ?? null, message: input.message })
      .returning({ id: messages.id });
    return { ok: true, data: { id: row.id } };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "The message store is temporarily unavailable.",
    };
  }
}
