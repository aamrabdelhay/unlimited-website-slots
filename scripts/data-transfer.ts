#!/usr/bin/env tsx
/**
 * Safe PostgreSQL data export / schema-remap / import workflow for moving a
 * slot's data into its extracted standalone database. No passwords are ever
 * requested — connections come from existing environment variables, and the
 * values are never printed.
 *
 * Usage:
 *   npm run slots:transfer -- export --slot 1 --out backups/slot-000001.sql
 *   npm run slots:transfer -- transform --in backups/slot-000001.sql \
 *       --out backups/standalone.sql --from-schema slot_000001 --to-schema public
 *   npm run slots:transfer -- import --file backups/standalone.sql \
 *       --target-env SLOT_000001_DATABASE_URL --confirm
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseSlotId, slotSchemaName } from "../src/lib/slot-ids";
import { resolveSlotDatabaseConfig } from "../src/lib/db-config";
import { loadSlotManifest, slotDirPath, sitesDirOf } from "./lib/slots-core";
import { tablesInDump, transformPgDumpData } from "./lib/extractor";

const repoRoot = path.resolve(__dirname, "..");

function fail(message: string): never {
  console.error(`[transfer] FAILED: ${message}`);
  process.exit(1);
}

function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function runTool(command: string, argv: string[], redact: string[]): void {
  // Echo the invocation with secrets masked, never the raw connection string.
  const shown = argv.map((arg) => (redact.some((secret) => secret && arg.includes(secret)) ? "«redacted»" : arg));
  console.log(`[transfer] $ ${command} ${shown.join(" ")}`);
  const result = spawnSync(command, argv, { cwd: repoRoot, stdio: "inherit", env: process.env });
  if (result.error) fail(`${command} is not available: ${result.error.message}. Install PostgreSQL client tools or run where they exist.`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status ?? "unknown"}.`);
}

function commandExport(argv: string[]): void {
  const slotRaw = argValue(argv, "--slot");
  const out = argValue(argv, "--out");
  if (!slotRaw || !out) fail("export needs --slot <N> and --out <file.sql>");
  const slot = parseSlotId(slotRaw);
  if (slot === null) fail(`invalid --slot "${slotRaw}"`);

  const dir = slotDirPath(sitesDirOf(repoRoot), slot);
  if (!existsSync(dir)) fail(`slot ${slot} is not registered.`);
  const manifest = loadSlotManifest(dir, slot);
  const config = resolveSlotDatabaseConfig(slot, manifest.database, process.env);

  const outPath = path.resolve(repoRoot, out);
  runTool("pg_dump", [
    "--data-only", "--inserts", "--no-owner", "--no-privileges",
    `--schema=${config.schema}`,
    `--file=${outPath}`,
    config.connectionString,
  ], [config.connectionString]);

  const sql = readFileSync(outPath, "utf8");
  console.log(`[transfer] export complete, rows per table:`);
  for (const [table, count] of tablesInDump(sql)) {
    console.log(`[transfer]   ${table}: ${count} row(s)`);
  }
}

function commandTransform(argv: string[]): void {
  const input = argValue(argv, "--in");
  const output = argValue(argv, "--out");
  const from = argValue(argv, "--from-schema");
  const to = argValue(argv, "--to-schema");
  if (!input || !output || !from || !to) {
    fail("transform needs --in, --out, --from-schema, and --to-schema");
  }
  const inPath = path.resolve(repoRoot, input);
  const outPath = path.resolve(repoRoot, output);
  if (!existsSync(inPath)) fail(`input file not found: ${inPath}`);
  if (existsSync(outPath) && !argv.includes("--force")) {
    fail(`refusing to overwrite existing file ${outPath} (pass --force).`);
  }
  const transformed = transformPgDumpData(readFileSync(inPath, "utf8"), from, to);
  writeFileSync(outPath, transformed, "utf8");
  console.log(`[transfer] transformed ${input} -> ${output} (schema ${from} -> ${to})`);
  for (const [table, count] of tablesInDump(transformed)) {
    console.log(`[transfer]   ${table}: ${count} row(s)`);
  }
}

function commandImport(argv: string[]): void {
  const file = argValue(argv, "--file");
  const targetEnv = argValue(argv, "--target-env");
  if (!file || !targetEnv) fail("import needs --file <file.sql> and --target-env <ENV_VAR_NAME>");
  if (!argv.includes("--confirm")) {
    fail("import writes into a database — re-run with --confirm (an operational safeguard, not a password).");
  }
  const targetUrl = process.env[targetEnv];
  if (!targetUrl) fail(`environment variable ${targetEnv} is not set.`);
  const filePath = path.resolve(repoRoot, file);
  if (!existsSync(filePath)) fail(`file not found: ${filePath}`);

  const sql = readFileSync(filePath, "utf8");
  runTool("psql", ["-v", "ON_ERROR_STOP=1", "-f", filePath, targetUrl], [targetUrl]);

  // Verify: report row counts actually present in the target for each table.
  console.log("[transfer] verifying row counts in target...");
  for (const [table] of tablesInDump(sql)) {
    const [schema, name] = table.includes(".") ? table.split(".") : ["public", table];
    runTool("psql", [
      "-t", "-A", "-c",
      `SELECT count(*) FROM "${schema}"."${name}";`,
      targetUrl,
    ], [targetUrl]);
  }
  console.log("[transfer] import + verification complete.");
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "export": return commandExport(rest);
    case "transform": return commandTransform(rest);
    case "import": return commandImport(rest);
    default:
      fail("usage: npm run slots:transfer -- <export|transform|import> [flags]");
  }
}

try {
  main();
} catch (error) {
  fail((error as Error).message);
}
