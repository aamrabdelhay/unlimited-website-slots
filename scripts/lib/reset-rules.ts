import { slotSchemaName } from "../../src/lib/slot-ids";
import type { SlotManifest } from "../../src/lib/manifest";

/**
 * Pure reset-safety rules, unit-tested independently of the CLI wrapper.
 * Confirmations are operational safeguards — there are no passwords here
 * or anywhere else in the platform.
 */

/** Extracted slots keep their history unless explicitly repurposed. */
export function assertResetAllowed(manifest: SlotManifest, options: { repurpose: boolean }): void {
  if (manifest.status === "extracted" && !options.repurpose) {
    throw new Error(
      `Slot ${manifest.slotId} was extracted to ${manifest.extraction?.destination ?? "a standalone project"}. ` +
      "Pass --repurpose to confirm reuse of this slot.",
    );
  }
}

/** Typed confirmation must match the target slot exactly. */
export function assertConfirmation(slot: number, confirm: number | undefined): void {
  if (confirm !== slot) {
    throw new Error(
      `Confirmation mismatch — re-run with --confirm ${slot} to execute. ` +
      "This safeguard prevents accidental resets; it is not a password prompt.",
    );
  }
}

/** The only schema a shared-mode reset may ever drop: the slot's own. */
export function assertSchemaTarget(slot: number, resolvedSchema: string, mode: string): void {
  const expected = slotSchemaName(slot);
  if (mode === "shared" && resolvedSchema !== expected) {
    throw new Error(
      `Refusing DDL: resolved schema "${resolvedSchema}" does not equal this slot's schema "${expected}". Another slot's data could be at risk — aborting.`,
    );
  }
}
