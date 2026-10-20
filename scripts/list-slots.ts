#!/usr/bin/env tsx
/**
 * List every registered website slot. No database required.
 *
 * Usage:
 *   npm run slots:list
 *   npm run slots:list -- --json      # machine-readable output
 */
import path from "node:path";
import { formatSlotId } from "../src/lib/slot-ids";
import { slotBasePath } from "../src/lib/platform-paths";
import { loadRegisteredSites, sitesDirOf } from "./lib/slots-core";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}

function main(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const json = process.argv.includes("--json");
  const { sites, warnings } = loadRegisteredSites(sitesDirOf(repoRoot));

  for (const warning of warnings) console.warn(`[list] warning: ${warning}`);

  if (json) {
    console.log(
      JSON.stringify(
        {
          count: sites.length,
          slots: sites.map((s) => ({
            slotId: s.slotId,
            name: s.manifest.name,
            status: s.manifest.status,
            description: s.manifest.description,
            updatedAt: s.manifest.updatedAt,
            basePath: slotBasePath(s.slotId),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (sites.length === 0) {
    console.log("No websites registered yet.");
    console.log("Create one with:  npm run slots:create");
    return;
  }

  const header = ["SLOT", "STATUS", "UPDATED", "NAME", "DESCRIPTION"];
  const rows = sites.map((s) => [
    formatSlotId(s.slotId),
    s.manifest.status,
    s.manifest.updatedAt.slice(0, 10),
    truncate(s.manifest.name, 28),
    truncate(s.manifest.description, 48),
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length)),
  );
  const format = (cols: string[]) =>
    cols.map((col, i) => col.padEnd(widths[i])).join("  ").trimEnd();

  console.log(format(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(format(row));
  console.log(`\n${sites.length} slot(s) registered. Sparse ids are supported — there is no maximum.`);
}

try {
  main();
} catch (error) {
  console.error(`[list] FAILED: ${(error as Error).message}`);
  process.exit(1);
}
