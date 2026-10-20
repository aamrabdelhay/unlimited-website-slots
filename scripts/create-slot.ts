#!/usr/bin/env tsx
/**
 * Create a website slot on demand — never overwrites an occupied slot.
 *
 * Usage:
 *   npm run slots:create                                  # next free id
 *   npm run slots:create -- --slot 127                    # specific id
 *   npm run slots:create -- --slot 3 --name "Law Firm" --status in-use \
 *       --description "Corporate law firm website"
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isValidSlotId, parseSlotId, slotDirName } from "../src/lib/slot-ids";
import { SLOT_STATUSES, type SlotStatus } from "../src/lib/manifest";
import { slotApiPath, slotBasePath } from "../src/lib/platform-paths";
import {
  loadRegisteredSites,
  nextAvailableSlotId,
  sitesDirOf,
} from "./lib/slots-core";
import { generateRegistry } from "./lib/registry-writer";
import { buildSlotScaffold } from "./lib/slot-template";

interface Args {
  slot?: number;
  name?: string;
  description?: string;
  status?: SlotStatus;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {};
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
      case "--description":
        if (!next) throw new Error("--description expects a value");
        args.description = next;
        i += 1;
        break;
      case "--status":
        if (!next || !(SLOT_STATUSES as readonly string[]).includes(next)) {
          throw new Error(`--status must be one of ${SLOT_STATUSES.join(", ")}`);
        }
        args.status = next as SlotStatus;
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function main(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const sitesDir = sitesDirOf(repoRoot);
  const args = parseArgs(process.argv.slice(2));

  const { sites } = loadRegisteredSites(sitesDir);
  const taken = new Set(sites.map((s) => s.slotId));

  let slot = args.slot;
  if (slot !== undefined) {
    if (!isValidSlotId(slot)) throw new Error(`Invalid slot id: ${slot}`);
    if (taken.has(slot)) {
      console.error(
        `[create] slot ${slot} is already occupied by "${sites.find((s) => s.slotId === slot)?.manifest.name}". Refusing to overwrite.`,
      );
      process.exit(1);
    }
  } else {
    slot = nextAvailableSlotId(taken);
  }

  const name = args.name?.trim() || `Untitled Website ${slot}`;
  const dirName = slotDirName(slot);
  const dir = path.join(sitesDir, dirName);
  if (existsSync(dir)) {
    console.error(`[create] directory already exists: ${dir}. Refusing to overwrite.`);
    process.exit(1);
  }

  const scaffold = buildSlotScaffold({
    slotId: slot,
    name,
    description: args.description,
    status: args.status ?? "empty",
  });

  mkdirSync(sitesDir, { recursive: true });
  mkdirSync(dir); // recursive:false — fails loudly if it somehow appeared
  for (const [relativeFile, content] of Object.entries(scaffold)) {
    const filePath = path.join(dir, relativeFile);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
  }
  console.log(`[create] scaffolded ${Object.keys(scaffold).length} files in sites/${dirName}`);

  const result = generateRegistry({ repoRoot, quiet: true });
  if (!result.slotIds.includes(slot)) {
    console.error(`[create] FAILED verification: slot ${slot} missing from generated route table.`);
    process.exit(1);
  }

  console.log(`[create] slot ${slot} registered and present in the generated route table.`);
  console.log(`[create]   name        ${name}`);
  console.log(`[create]   website     ${slotBasePath(slot)}`);
  console.log(`[create]   api         ${slotApiPath(slot, "/")}`);
  console.log(`[create] next steps: build the site inside sites/${dirName}, then run \`npm run build\`.`);
}

try {
  main();
} catch (error) {
  console.error(`[create] FAILED: ${(error as Error).message}`);
  process.exit(1);
}
