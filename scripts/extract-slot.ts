#!/usr/bin/env tsx
/**
 * Extract a slot into a standalone Next.js project (no passwords involved).
 *
 * Usage:
 *   npm run slots:extract -- --slot 3 --name client-portal
 *   npm run slots:extract -- --slot 3 --name client-portal --dest ../somewhere
 *   npm run slots:extract -- --slot 3 --name client-portal --dry-run
 *   npm run slots:extract -- --slot 3 --name client-portal --verify-install
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseSlotId } from "../src/lib/slot-ids";
import { extractSlot, planExtraction } from "./lib/extractor";
import { generateRegistry } from "./lib/registry-writer";

interface Args {
  slot?: number;
  name?: string;
  dest?: string;
  dryRun: boolean;
  verifyInstall: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, verifyInstall: false };
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
      case "--name":
        if (!next) throw new Error("--name expects a value");
        args.name = next;
        i += 1;
        break;
      case "--dest":
        if (!next) throw new Error("--dest expects a path");
        args.dest = next;
        i += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--verify-install":
        args.verifyInstall = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.slot === undefined) throw new Error("--slot is required.");
  if (!args.name) throw new Error("--name is required (standalone project name).");
  return args;
}

function run(command: string, argv: string[], cwd: string): void {
  console.log(`[extract] $ ${command} ${argv.join(" ")}  (in ${cwd})`);
  const result = spawnSync(command, argv, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${argv.join(" ")} exited with code ${result.status ?? "unknown"}.`);
  }
}

function main(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const args = parseArgs(process.argv.slice(2));
  const slot = args.slot as number;
  const name = args.name as string;

  const plan = planExtraction(repoRoot, slot, name, args.dest ? path.resolve(args.dest) : undefined);
  console.log(`[extract] slot ${slot} -> ${plan.destDir}`);

  if (args.dryRun) {
    console.log("[extract] dry run — no files written, manifest untouched.");
    console.log(`[extract] source: ${plan.sourceDir}`);
    return;
  }

  const report = extractSlot(repoRoot, plan);
  console.log(`[extract] copied ${report.filesCopied} site file(s)`);
  console.log(`[extract] copied platform libs: ${report.libsCopied.join(", ") || "none"}`);
  for (const check of report.checks) {
    console.log(`[extract] check ${check.name}: ${check.passed ? "PASS" : "FAIL"}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  if (report.manifestMarked) {
    console.log("[extract] source slot manifest marked as extracted (source code + data preserved).");
  }

  if (args.verifyInstall) {
    run("npm", ["install"], plan.destDir);
    run("npm", ["run", "typecheck"], plan.destDir);
    run("npm", ["run", "build"], plan.destDir);
    console.log("[extract] standalone install + typecheck + build verified.");
  } else {
    console.log("[extract] skipped standalone install/build (pass --verify-install to run them).");
  }

  generateRegistry({ repoRoot, quiet: true });
  console.log("[extract] registry regenerated. Done.");
}

try {
  main();
} catch (error) {
  console.error(`[extract] FAILED: ${(error as Error).message}`);
  process.exit(1);
}
