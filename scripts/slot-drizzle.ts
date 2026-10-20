#!/usr/bin/env tsx
/**
 * Run drizzle-kit against a specific slot's own configuration. Migrations
 * always target that slot's schema (schemaFilter is set in its config).
 *
 * Usage:
 *   npm run slot:db -- --slot 1 --cmd generate
 *   npm run slot:db -- --slot 1 --cmd push
 *   npm run slot:db -- --slot 1 --cmd studio
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseSlotId, slotDirName } from "../src/lib/slot-ids";
import { loadSlotManifest, slotDirPath, sitesDirOf } from "./lib/slots-core";

function main(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const argv = process.argv.slice(2);
  let slot: number | null = null;
  let cmd: string | null = null;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--slot") {
      const parsed = argv[i + 1] ? parseSlotId(argv[i + 1]) : null;
      if (parsed === null) throw new Error(`--slot expects a positive integer, got "${argv[i + 1] ?? ""}"`);
      slot = parsed;
      i += 1;
    } else if (arg === "--cmd") {
      cmd = argv[i + 1] ?? null;
      if (!cmd) throw new Error("--cmd expects a drizzle-kit command (generate, push, …)");
      i += 1;
    } else {
      rest.push(arg);
    }
  }
  if (slot === null || cmd === null) {
    throw new Error("Usage: npm run slot:db -- --slot <N> --cmd <drizzle-kit command> [-- extra flags]");
  }

  const dir = slotDirPath(sitesDirOf(repoRoot), slot);
  if (!existsSync(dir)) throw new Error(`Slot ${slot} is not registered.`);
  loadSlotManifest(dir, slot); // validates manifest before touching the DB

  const configPath = path.join(dir, "drizzle.config.ts");
  if (!existsSync(configPath)) throw new Error(`Slot ${slot} has no drizzle.config.ts.`);

  console.log(`[slot:db] drizzle-kit ${cmd} for ${slotDirName(slot)} (schemaFilter is limited to its own schema)`);
  const result = spawnSync(
    "npx",
    ["drizzle-kit", cmd, "--config", path.relative(repoRoot, configPath), ...rest],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[slot:db] FAILED: ${(error as Error).message}`);
  process.exit(1);
}
