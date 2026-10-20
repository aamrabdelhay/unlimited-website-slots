#!/usr/bin/env tsx
/**
 * Scan `sites/` and regenerate:
 *   - src/generated/slot-registry.ts  (static imports for the bundler)
 *   - src/generated/registry.json     (dashboard index)
 *   - registry.json                   (repo-level human index)
 *
 * Usage: npm run registry:generate
 */
import path from "node:path";
import { generateRegistry } from "./lib/registry-writer";

const repoRoot = path.resolve(__dirname, "..");
const quiet = process.argv.includes("--quiet");

try {
  const result = generateRegistry({ repoRoot, quiet });
  if (!quiet) {
    console.log(
      `[registry] generated route table for ${result.slotIds.length} slot(s): ${
        result.slotIds.length ? result.slotIds.join(", ") : "(none)"
      }`,
    );
    for (const file of result.files) {
      console.log(`[registry] wrote ${path.relative(repoRoot, file)}`);
    }
  }
} catch (error) {
  console.error(`[registry] FAILED: ${(error as Error).message}`);
  process.exit(1);
}
