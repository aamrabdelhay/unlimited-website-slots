import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createManifest } from "../src/lib/manifest";
import {
  assertConfirmation,
  assertResetAllowed,
  assertSchemaTarget,
} from "../scripts/lib/reset-rules";

function* walk(dir: string, filter: (file: string) => boolean): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (["node_modules", ".next", ".git", ".backups"].includes(entry)) continue;
      yield* walk(full, filter);
    } else if (stats.isFile() && filter(full)) {
      yield full;
    }
  }
}

const APP_CODE = [...walk(path.resolve("src"), (f) => /\.(ts|tsx)$/.test(f))];
const SITE_CODE = [...walk(path.resolve("sites"), (f) => /\.(ts|tsx)$/.test(f))];
const SCRIPT_CODE = [...walk(path.resolve("scripts"), (f) => /\.ts$/.test(f))];

describe("password-free operation (enforced, not assumed)", () => {
  it("no password inputs, password fields, or password env vars exist in shipped code", () => {
    const offenders: string[] = [];
    const patterns = [
      /type\s*=\s*["']password["']/i,
      /name\s*=\s*["']password["']/i,
      /autocomplete\s*=\s*["'](?:new|current)-password["']/i,
      /\b(?:ADMIN|DASHBOARD|SITE|PANEL)_PASSWORD\b/,
      /process\.env\.[A-Z_]*PASSWORD/i,
    ];
    for (const file of [...APP_CODE, ...SITE_CODE, ...SCRIPT_CODE]) {
      const content = readFileSync(file, "utf8");
      if (patterns.some((pattern) => pattern.test(content))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("there is no login or signup route anywhere in the app", () => {
    const loginFiles = [
      ...walk(path.resolve("src/app"), (f) => /(?:^|[/\\])(login|signin|sign-in|signup|register)[/\\]/.test(f)),
    ];
    expect(loginFiles).toEqual([]);
  });
});

describe("no arbitrary slot ceiling", () => {
  it("no MAX_SLOT-style constant or hardcoded 20-slot limit exists", () => {
    const offenders: string[] = [];
    const patterns = [
      /MAX_?SLOT/i,
      /SLOTS?_LIMIT/i,
      /\bslot\s*(?:<|<=|>|>=)\s*(?:20|100|1000)\b/,
      /Array\.from\(\{ ?length: ?(?:20|100) ?\}/,
    ];
    for (const file of [...APP_CODE, ...SITE_CODE, ...SCRIPT_CODE]) {
      const content = readFileSync(file, "utf8");
      if (patterns.some((pattern) => pattern.test(content))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("cross-slot import prevention", () => {
  it("no slot imports code from another slot or from the central registry/db", () => {
    const offenders: string[] = [];
    const forbidden = /sites[\\/]slot-|\.\.[\\/]\.\.[\\/]slot-|@\/generated|@\/db["'/]/;
    for (const file of SITE_CODE) {
      const content = readFileSync(file, "utf8");
      // Scope to actual import/export/require statements — doc strings are fine.
      const importLines = content
        .split("\n")
        .filter((line) => /\bimport\b|\bexport\s+.*\bfrom\b|\brequire\s*\(/.test(line));
      if (importLines.some((line) => forbidden.test(line))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("dashboard never touches secrets or requires a database", () => {
  it("dashboard page source reads no env vars, no db client, no connection strings", () => {
    const source = readFileSync(path.resolve("src/app/page.tsx"), "utf8");
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/@\/db|@\/lib\/slot-db/);
    expect(source).not.toMatch(/postgres(?:ql)?:\/\//);
    expect(source).toMatch(/@\/generated\/registry\.json/); // static snapshot only
  });

  it("public slots API exposes only registry metadata", () => {
    const source = readFileSync(path.resolve("src/app/api/slots/route.ts"), "utf8");
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/@\/db|pg/);
  });

  it("homepage shows ordered live thumbnails, numbered by slot id", () => {
    const page = readFileSync(path.resolve("src/app/page.tsx"), "utf8");
    // slots are sorted by slot id before rendering — numbering IS the order
    expect(page).toMatch(/\.sort\(\(a, b\) => a\.slotId - b\.slotId\)/);

    const browser = readFileSync(path.resolve("src/components/deck-browser.tsx"), "utf8");
    expect(browser).toContain("SiteThumbnail");

    const thumb = readFileSync(path.resolve("src/components/site-thumbnail.tsx"), "utf8");
    expect(thumb).toMatch(/sandbox/);               // previews can't run scripts
    expect(thumb).toMatch(/IntersectionObserver/);  // lazy mount: scales to many sites
    expect(thumb).toMatch(/formatSlotId\(slotId\)/); // slot number on every thumbnail
    expect(thumb).toMatch(/pointer-events-none/);   // pure preview, no interaction
    expect(thumb).not.toMatch(/process\.env/);
  });
});

describe("reset safeguards", () => {
  const NOW = "2026-01-02T03:04:05.000Z";

  it("blocks resetting an extracted slot unless explicitly repurposed", () => {
    const manifest = createManifest({ slotId: 3, name: "Law", now: NOW });
    manifest.status = "extracted";
    manifest.extraction = { destination: "../client-portal", extractedAt: NOW };
    expect(() => assertResetAllowed(manifest, { repurpose: false })).toThrow(/repurpose/);
    expect(() => assertResetAllowed(manifest, { repurpose: true })).not.toThrow();
  });

  it("requires the typed confirmation to match the slot exactly", () => {
    expect(() => assertConfirmation(3, 4)).toThrow(/Confirmation mismatch/);
    expect(() => assertConfirmation(3, undefined)).toThrow(/Confirmation mismatch/);
    expect(() => assertConfirmation(3, 3)).not.toThrow();
  });

  it("never allows dropping a schema that belongs to another slot", () => {
    expect(() => assertSchemaTarget(3, "slot_000004", "shared")).toThrow(/Refusing DDL/);
    expect(() => assertSchemaTarget(3, "public", "shared")).toThrow(/Refusing DDL/);
    expect(() => assertSchemaTarget(3, "slot_000003", "shared")).not.toThrow();
    // dedicated mode resets target their own database's schema:
    expect(() => assertSchemaTarget(3, "client_schema", "dedicated")).not.toThrow();
  });
});
