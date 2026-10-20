#!/usr/bin/env tsx
/**
 * Safely reset a website slot. Destructive steps require an explicit
 * typed confirmation (--confirm <slot>) — never a password.
 *
 * Usage:
 *   npm run slots:reset -- --slot 3 --dry-run
 *   npm run slots:reset -- --slot 3 --confirm 3
 *   npm run slots:reset -- --slot 3 --confirm 3 --db          # also drop DB schema
 *   npm run slots:reset -- --slot 3 --confirm 3 --repurpose   # reuse an extracted slot
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { parseSlotId, slotSchemaName } from "../src/lib/slot-ids";
import { resolveSlotDatabaseConfig } from "../src/lib/db-config";
import { parseManifest } from "../src/lib/manifest";
import { loadSlotManifest, slotDirPath, sitesDirOf } from "./lib/slots-core";
import { generateRegistry } from "./lib/registry-writer";
import { buildSlotScaffold } from "./lib/slot-template";
import { assertConfirmation, assertResetAllowed, assertSchemaTarget } from "./lib/reset-rules";

interface Args {
  slot?: number;
  confirm?: number;
  dryRun: boolean;
  dropDatabase: boolean;
  repurpose: boolean;
  allowProduction: boolean;
  name?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, dropDatabase: false, repurpose: false, allowProduction: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--slot": {
        const parsed = next ? parseSlotId(next) : null;
        if (parsed === null) throw new Error(`--slot expects a positive integer, got "${next ?? ""}"`);
        args.slot = parsed;
        i += 1;
        break;
      }
      case "--confirm": {
        const parsed = next ? parseSlotId(next) : null;
        if (parsed === null) throw new Error(`--confirm expects the slot number, got "${next ?? ""}"`);
        args.confirm = parsed;
        i += 1;
        break;
      }
      case "--dry-run": args.dryRun = true; break;
      case "--db": args.dropDatabase = true; break;
      case "--repurpose": args.repurpose = true; break;
      case "--allow-production": args.allowProduction = true; break;
      case "--name":
        if (!next) throw new Error("--name expects a value");
        args.name = next;
        i += 1;
        break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.slot === undefined) throw new Error("--slot is required.");
  return args;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv.slice(2));
  const slot = args.slot as number;
  const sitesDir = sitesDirOf(repoRoot);
  const dir = slotDirPath(sitesDir, slot);

  if (!existsSync(dir)) {
    console.error(`[reset] slot ${slot} is not registered — nothing to reset.`);
    process.exit(1);
  }
  const manifest = loadSlotManifest(dir, slot);

  try {
    assertResetAllowed(manifest, { repurpose: args.repurpose });
  } catch (error) {
    console.error(`[reset] ${(error as Error).message}`);
    process.exit(1);
  }

  const expectedSchema = slotSchemaName(slot);
  const backupDir = path.join(repoRoot, ".backups", `slot-${String(slot).padStart(6, "0")}-${Date.now()}`);

  // ---- Plan ----------------------------------------------------------------
  console.log(`[reset] plan for slot ${slot} ("${manifest.name}"):`);
  console.log(`[reset]   1. backup  ${path.relative(repoRoot, dir)} -> ${path.relative(repoRoot, backupDir)}`);
  console.log(`[reset]   2. rewrite website source to the empty-slot scaffold (status: empty)`);
  console.log(`[reset]   3. keep createdAt (${manifest.createdAt}), set status -> empty`);
  if (args.dropDatabase) {
    console.log(`[reset]   4. DATABASE: DROP SCHEMA IF EXISTS "${expectedSchema}" CASCADE  (via slot-scoped config)`);
  } else {
    console.log(`[reset]   4. database untouched (pass --db to also drop schema "${expectedSchema}")`);
  }

  if (args.dryRun) {
    console.log("[reset] dry run — nothing was changed.");
    return;
  }
  try {
    assertConfirmation(slot, args.confirm);
  } catch (error) {
    console.error(`[reset] ${(error as Error).message}`);
    process.exit(1);
  }

  // ---- 1. Backup -------------------------------------------------------------
  mkdirSync(path.dirname(backupDir), { recursive: true });
  cpSync(dir, backupDir, { recursive: true });
  console.log(`[reset] backup written to ${path.relative(repoRoot, backupDir)}`);

  // ---- 2. Source reset ---------------------------------------------------------
  for (const entry of readdirSync(dir)) {
    rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
  const scaffold = buildSlotScaffold({
    slotId: slot,
    name: args.name ?? `Untitled Website ${slot}`,
    status: "empty",
  });
  for (const [relativeFile, content] of Object.entries(scaffold)) {
    if (relativeFile === "manifest.json") continue; // manifest is rewritten below
    const filePath = path.join(dir, relativeFile);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
  }

  const resetAt = new Date().toISOString();
  const newManifest = parseManifest({
    slotId: slot,
    name: args.name ?? `Untitled Website ${slot}`,
    description: "",
    status: "empty",
    createdAt: manifest.createdAt,
    updatedAt: resetAt,
    database: manifest.database.mode === "standalone" ? { mode: "shared", schema: expectedSchema } : manifest.database,
    notes: `${manifest.notes ? `${manifest.notes}\n` : ""}[${resetAt}] Slot reset. Backup: ${path.relative(repoRoot, backupDir)}${manifest.extraction ? ` (previously extracted to ${manifest.extraction.destination})` : ""}`,
    extraction: manifest.extraction, // history preserved
  });
  writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(newManifest, null, 2)}\n`, "utf8");
  console.log("[reset] website source reset to the empty scaffold.");

  // ---- 3. Optional database drop ------------------------------------------------
  if (args.dropDatabase) {
    if (process.env.NODE_ENV === "production" && !args.allowProduction) {
      console.error("[reset] refusing to drop a database schema while NODE_ENV=production (pass --allow-production to override).");
      process.exit(1);
    }
    const config = resolveSlotDatabaseConfig(slot, newManifest.database, process.env);
    // Double-check the target before DDL: the scoped schema must be this slot's.
    try {
      assertSchemaTarget(slot, config.schema, config.mode);
    } catch (error) {
      console.error(`[reset] ${(error as Error).message}`);
      process.exit(1);
    }
    console.log(`[reset] dropping schema "${config.schema}" via ${config.sourceEnvVar} (connection string not shown)...`);
    const pool = new Pool({ connectionString: config.connectionString });
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${config.schema}" CASCADE`);
      console.log(`[reset] schema "${config.schema}" dropped.`);
    } finally {
      await pool.end();
    }
  }

  generateRegistry({ repoRoot, quiet: true });
  console.log("[reset] registry regenerated. Done.");
}

main().catch((error) => {
  console.error(`[reset] FAILED: ${(error as Error).message}`);
  process.exit(1);
});
