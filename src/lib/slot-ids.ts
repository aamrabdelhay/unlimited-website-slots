/**
 * Slot identity primitives.
 *
 * A slot is identified by any positive safe integer. There is deliberately
 * NO maximum slot id anywhere in this codebase — capacity is bounded only
 * by filesystem, build, and infrastructure limits.
 */

export const SLOT_DIR_PREFIX = "slot-";
export const SLOT_ID_PAD = 6;

/** Returns true when `value` is a usable slot id (positive safe integer). */
export function isValidSlotId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Parse a numeric slot id from a string/number (defensively), or return null. */
export function parseSlotId(input: unknown): number | null {
  if (typeof input === "number") return isValidSlotId(input) ? input : null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isValidSlotId(value) ? value : null;
}

/**
 * Parse a public route parameter such as "1", "127" or a directory-style
 * identifier such as "slot-000127".
 */
export function parseSlotParam(param: string): number | null {
  if (/^\d+$/.test(param)) return parseSlotId(param);
  const match = /^slot-(\d{6,})$/.exec(param);
  if (match) return parseSlotId(match[1]);
  return null;
}

/** Zero-padded directory name for a slot, e.g. 127 -> "slot-000127". */
export function slotDirName(slotId: number): string {
  if (!isValidSlotId(slotId)) {
    throw new RangeError(`Invalid slot id: ${String(slotId)}`);
  }
  return `${SLOT_DIR_PREFIX}${String(slotId).padStart(SLOT_ID_PAD, "0")}`;
}

/** Inverse of slotDirName; returns null for unrelated directory names. */
export function parseSlotDirName(name: string): number | null {
  const match = /^slot-(\d{6,})$/.exec(name);
  if (!match) return null;
  return parseSlotId(match[1]);
}

/**
 * PostgreSQL schema that a slot owns in shared-database mode.
 * ALWAYS derived from the validated slot id server-side — never from
 * client input or request data.
 */
export function slotSchemaName(slotId: number): string {
  if (!isValidSlotId(slotId)) {
    throw new RangeError(`Invalid slot id: ${String(slotId)}`);
  }
  return `slot_${String(slotId).padStart(SLOT_ID_PAD, "0")}`;
}

/** Convention-based dedicated database env var, e.g. SLOT_000127_DATABASE_URL. */
export function slotDatabaseEnvVar(slotId: number): string {
  if (!isValidSlotId(slotId)) {
    throw new RangeError(`Invalid slot id: ${String(slotId)}`);
  }
  return `SLOT_${String(slotId).padStart(SLOT_ID_PAD, "0")}_DATABASE_URL`;
}

/** Display helper: 127 -> "#000127". */
export function formatSlotId(slotId: number): string {
  return `#${String(slotId).padStart(SLOT_ID_PAD, "0")}`;
}
