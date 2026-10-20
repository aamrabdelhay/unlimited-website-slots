import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateRegistry, generateRegistryCode } from "../scripts/lib/registry-writer";
import { loadRegisteredSites, nextAvailableSlotId } from "../scripts/lib/slots-core";
import { buildSlotScaffold } from "../scripts/lib/slot-template";
import { parseManifest, createManifest } from "../src/lib/manifest";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "slots-test-"));
});
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function makeSlot(root: string, slot: number, name = `Site ${slot}`): void {
  const scaffold = buildSlotScaffold({ slotId: slot, name, now: "2026-01-02T03:04:05.000Z" });
  for (const [relative, content] of Object.entries(scaffold)) {
    const file = path.join(root, "sites", `slot-${String(slot).padStart(6, "0")}`, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
  }
}

describe("slot scaffolding", () => {
  it("produces a valid manifest, db scaffolding, and no passwords anywhere", () => {
    const scaffold = buildSlotScaffold({ slotId: 127, name: "Sparse Site", now: "2026-01-02T03:04:05.000Z" });
    expect(Object.keys(scaffold)).toEqual(
      expect.arrayContaining([
        "manifest.json", "site.tsx", "pages/home.tsx", "styles.ts",
        "lib/db.ts", "db/schema.ts", "drizzle.config.ts", "README.md",
      ]),
    );
    const manifest = parseManifest(JSON.parse(scaffold["manifest.json"]));
    expect(manifest.slotId).toBe(127);
    expect(manifest.database.schema).toBe("slot_000127");
    expect(scaffold["db/schema.ts"]).toContain('pgSchema("slot_000127")');
    for (const [file, content] of Object.entries(scaffold)) {
      expect(content.toLowerCase(), `scaffold file ${file} must not reference passwords`).not.toMatch(/password/);
    }
  });
});

describe("next available slot id", () => {
  it("skips taken ids without any ceiling", () => {
    expect(nextAvailableSlotId([])).toBe(1);
    expect(nextAvailableSlotId([1, 2, 3])).toBe(4);
    expect(nextAvailableSlotId([1, 3, 127])).toBe(2); // sparse ids preserved
    expect(nextAvailableSlotId([10_000])).toBe(1);
  });
});

describe("registry generation with sparse, arbitrarily numbered slots", () => {
  it("registers slots 3, 127, and 10000 in a verified route table", () => {
    makeSlot(workDir, 3, "Law Firm");
    makeSlot(workDir, 127, "Arabic Academy");
    makeSlot(workDir, 10_000, "Far Future Site");

    const result = generateRegistry({
      repoRoot: workDir,
      quiet: true,
      now: "2026-02-01T00:00:00.000Z",
    });

    expect(result.slotIds).toEqual([3, 127, 10_000]);
    expect(result.index.slots.map((s) => s.basePath)).toEqual(["/s/3", "/s/127", "/s/10000"]);

    const code = readFileSync(path.join(workDir, "src/generated/slot-registry.ts"), "utf8");
    for (const slot of [3, 127, 10_000]) {
      expect(code).toContain(`slotId: ${slot},`); // route table verification
    }
    expect(code).toContain(`from "../../sites/slot-000127/site"`); // static imports
    expect(code).toContain(`from "../../sites/slot-010000/site"`);

    // JSON indexes exist and are identical (root + src/generated)
    const rootJson = readFileSync(path.join(workDir, "registry.json"), "utf8");
    const generatedJson = readFileSync(path.join(workDir, "src/generated/registry.json"), "utf8");
    expect(rootJson).toBe(generatedJson);
  });

  it("generates an empty-but-valid registry for zero slots", () => {
    const result = generateRegistry({ repoRoot: workDir, quiet: true, now: "2026-02-01T00:00:00.000Z" });
    expect(result.slotIds).toEqual([]);
    const code = readFileSync(path.join(workDir, "src/generated/slot-registry.ts"), "utf8");
    expect(code).toContain("SLOT_ENTRIES: readonly SlotRegistryEntry[] = [];");
  });

  it("fails closed on an invalid manifest (never registers bad data)", () => {
    makeSlot(workDir, 9);
    const manifestPath = path.join(workDir, "sites", "slot-000009", "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ garbage: true }), "utf8");
    expect(() => generateRegistry({ repoRoot: workDir, quiet: true })).toThrow(/Invalid/);
  });

  it("warns on malformed directories instead of crashing", () => {
    mkdirSync(path.join(workDir, "sites", "slot-12"), { recursive: true }); // bad padding
    makeSlot(workDir, 5);
    const { sites, warnings } = loadRegisteredSites(path.join(workDir, "sites"));
    expect(sites.map((s) => s.slotId)).toEqual([5]);
    expect(warnings.some((w) => w.includes("slot-12"))).toBe(true);
  });

  it("generated code parses manifests at module load (fail-loud on hand edits)", () => {
    makeSlot(workDir, 3);
    const { sites } = loadRegisteredSites(path.join(workDir, "sites"));
    const code = generateRegistryCode(sites);
    expect(code).toContain("slotManifestSchema.parse(rawManifest_slot_000003)");
  });
});

describe("manifest creation is time-safe", () => {
  it("uses real timestamps by default", () => {
    const manifest = createManifest({ slotId: 1, name: "Now" });
    expect(Number.isNaN(Date.parse(manifest.createdAt))).toBe(false);
  });
});
