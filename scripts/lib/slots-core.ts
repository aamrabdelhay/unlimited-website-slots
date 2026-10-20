import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseSlotDirName, slotDirName, slotSchemaName } from "../../src/lib/slot-ids";
import { parseManifest, type SlotManifest } from "../../src/lib/manifest";

/**
 * Filesystem-level slot discovery + manifest IO shared by every management
 * script and by the test suite. Lives outside `src/` so it can use Node APIs.
 */

export interface RegisteredSite {
  slotId: number;
  dirName: string;
  dir: string;
  manifestPath: string;
  manifest: SlotManifest;
}

export interface ScanResult {
  sites: RegisteredSite[];
  warnings: string[];
}

export function sitesDirOf(repoRoot: string): string {
  return path.join(repoRoot, "sites");
}

/** Write a file atomically (tmp + rename) so registries never tear. */
export function atomicWriteFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

/** Guard against path traversal: ensures `target` stays inside `root`. */
export function assertPathInside(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(`Refusing to touch path outside the workspace: ${target}`);
  }
  return resolvedTarget;
}

/** Discover slot directories without reading manifests. */
export function scanSlotDirectories(sitesDir: string): { slotId: number; dirName: string; warnings: string[] }[] {
  if (!existsSync(sitesDir)) return [];
  const entries = readdirSync(sitesDir, { withFileTypes: true });
  const found: { slotId: number; dirName: string; warnings: string[] }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slotId = parseSlotDirName(entry.name);
    if (slotId === null) {
      if (entry.name.startsWith("slot-")) {
        found.push({ slotId: -1, dirName: entry.name, warnings: [`Ignoring malformed slot directory "${entry.name}" (expected slot-NNNNNN).`] });
      }
      continue;
    }
    found.push({ slotId, dirName: entry.name, warnings: [] });
  }
  return found;
}

/** Read + validate a slot's manifest against the directory identity. */
export function loadSlotManifest(dir: string, expectedSlotId?: number): SlotManifest {
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Unparseable manifest at ${manifestPath}: ${(error as Error).message}`);
  }
  const manifest = parseManifest(raw, manifestPath);
  if (expectedSlotId !== undefined && manifest.slotId !== expectedSlotId) {
    throw new Error(
      `Manifest slotId ${manifest.slotId} does not match its directory (expected ${expectedSlotId}) at ${manifestPath}`,
    );
  }
  // Shared mode always derives the schema from the slot id; heal drift.
  if (manifest.database.mode === "shared") {
    manifest.database.schema = slotSchemaName(manifest.slotId);
  }
  return manifest;
}

/** Full validated scan of `sites/`. Throws on invalid data; collects warnings. */
export function loadRegisteredSites(sitesDir: string): ScanResult {
  const discovered = scanSlotDirectories(sitesDir);
  const warnings: string[] = [];
  const sites: RegisteredSite[] = [];
  const seen = new Set<number>();

  for (const item of discovered) {
    warnings.push(...item.warnings);
    if (item.slotId < 0) continue;
    if (seen.has(item.slotId)) {
      throw new Error(`Duplicate slot id ${item.slotId} found in ${sitesDir}`);
    }
    seen.add(item.slotId);
    const dir = path.join(sitesDir, item.dirName);
    const manifest = loadSlotManifest(dir, item.slotId);
    sites.push({
      slotId: item.slotId,
      dirName: item.dirName,
      dir,
      manifestPath: path.join(dir, "manifest.json"),
      manifest,
    });
  }

  sites.sort((a, b) => a.slotId - b.slotId);
  return { sites, warnings };
}

/** Persist a manifest atomically with a normalized shape. */
export function writeManifest(dir: string, manifest: SlotManifest): void {
  atomicWriteFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Next free positive integer id — no ceiling, sparse ids supported. */
export function nextAvailableSlotId(taken: Iterable<number>): number {
  const used = new Set(taken);
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

/** Absolute path a slot directory would occupy. */
export function slotDirPath(sitesDir: string, slotId: number): string {
  return path.join(sitesDir, slotDirName(slotId));
}
