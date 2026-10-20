import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractSlot,
  planExtraction,
  rewriteDdlSchema,
  rewriteDrizzleSchemaCall,
  rewriteSlotUrls,
  tablesInDump,
  transformPgDumpData,
} from "../scripts/lib/extractor";
import { buildSlotScaffold } from "../scripts/lib/slot-template";
import { loadSlotManifest } from "../scripts/lib/slots-core";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "extract-test-"));
});
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("standalone URL rewriting", () => {
  it("rewrites public + API URLs with boundary awareness", () => {
    const source = [
      `<a href="/s/3/about">About</a>`,
      `fetch("/api/s/3/messages")`,
      `path: "/s/3"`,
      `<a href='/s/3/work/courtyard-house'>`,
      "const other = `/s/31/team`; // slot 31 must survive",
      `const text = "visit /s/300 later";`,
    ].join("\n");
    const out = rewriteSlotUrls(source, 3);
    expect(out).toContain(`href="/about"`);
    expect(out).toContain(`fetch("/api/messages")`);
    expect(out).toContain(`path: ""`);
    expect(out).toContain(`href='/work/courtyard-house'`);
    expect(out).toContain(`/s/31/team`); // boundary: untouched
    expect(out).toContain(`/s/300 later`); // boundary: untouched
  });
});

describe("pg_dump data transform — row data is never mangled", () => {
  const dump = [
    `SET statement_timeout = 0;`,
    `SET search_path = slot_000001, pg_catalog;`,
    `INSERT INTO "slot_000001"."messages" ("id", "name", "message") VALUES (1, 'Ada', 'I read about slot_000001.schema design');`,
    `INSERT INTO slot_000001.messages (id, name, message) VALUES (2, 'Bo', 'hello');`,
    `COPY slot_000001.messages (id, name, message) FROM stdin;`,
    `3\tCid\tliterally says slot_000001.messages in the data`,
    `\\.`,
    `SELECT pg_catalog.setval('slot_000001.messages_id_seq', 3, true);`,
  ].join("\n");

  it("rewrites statement heads only", () => {
    const out = transformPgDumpData(dump, "slot_000001", "public");
    expect(out).toContain(`SET search_path TO public, pg_catalog;`);
    expect(out).toContain(`INSERT INTO "public"."messages" ("id", "name", "message") VALUES (1, 'Ada', 'I read about slot_000001.schema design');`);
    expect(out).toContain(`INSERT INTO "public".messages (id, name, message)`);
    expect(out).toContain(`COPY "public".messages`); // preserves the table's own quoting style
    expect(out).toContain(`literally says slot_000001.messages in the data`); // COPY payload untouched
    expect(out).toContain(`setval('"public".messages_id_seq'`);
  });

  it("rejects unsafe schema identifiers", () => {
    expect(() => transformPgDumpData(dump, "slot-1", "public")).toThrow(/Unsafe/);
    expect(() => transformPgDumpData(dump, "a", "b; DROP TABLE")).toThrow(/Unsafe/);
  });

  it("rewrites trusted DDL and Drizzle schema calls", () => {
    const ddl = `CREATE SCHEMA IF NOT EXISTS "slot_000001";\nCREATE TABLE IF NOT EXISTS "slot_000001"."messages" ("id" serial PRIMARY KEY);`;
    expect(rewriteDdlSchema(ddl, "slot_000001", "public")).toContain(`"public"."messages"`);
    expect(rewriteDdlSchema(ddl, "slot_000001", "public")).toContain(`CREATE SCHEMA IF NOT EXISTS "public"`);

    const drizzle = `export const slotSchema = pgSchema("slot_000001");`;
    expect(rewriteDrizzleSchemaCall(drizzle, "slot_000001", "public")).toContain(`pgSchema("public")`);
  });

  it("counts rows per table for verification", () => {
    expect(tablesInDump(dump).get("slot_000001.messages")).toBe(2);
  });
});

describe("end-to-end extraction into a standalone project", () => {
  function makeRepo(slot: number): string {
    const repo = path.join(workDir, "platform");
    mkdirSync(path.join(repo, "src", "lib"), { recursive: true });
    // Copy the real platform libs the site will import.
    for (const lib of ["site-contract", "routes", "slot-ids", "manifest", "db-config", "slot-db", "rate-limit", "platform-paths"]) {
      cpSync(path.resolve("src/lib", `${lib}.ts`), path.join(repo, "src", "lib", `${lib}.ts`));
    }
    writeFileSync(
      path.join(repo, "package.json"),
      JSON.stringify({
        dependencies: { next: "16.2.6", react: "19.2.6", "react-dom": "19.2.6", "drizzle-orm": "0.45.2", pg: "8.20.0", zod: "4.6.7" },
        devDependencies: { typescript: "5.9.3", tailwindcss: "4.1.17", "@tailwindcss/postcss": "4.1.17" },
      }),
      "utf8",
    );
    const scaffold = buildSlotScaffold({ slotId: slot, name: "Law Firm", now: "2026-01-02T03:04:05.000Z" });
    for (const [relative, content] of Object.entries(scaffold)) {
      const file = path.join(repo, "sites", `slot-${String(slot).padStart(6, "0")}`, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, "utf8");
    }
    // Site files that reference monorepo URLs + platform libs.
    writeFileSync(
      path.join(repo, "sites", `slot-${String(slot).padStart(6, "0")}`, "pages", "about.tsx"),
      `export function AboutPage() { return <a href="/s/${slot}/contact">Contact</a>; }\n`,
      "utf8",
    );
    writeFileSync(
      path.join(repo, "sites", `slot-${String(slot).padStart(6, "0")}`, "site.tsx"),
      [
        `import type { SiteDefinition } from "@/lib/site-contract";`,
        `import { AboutPage } from "./pages/about";`,
        `export const site: SiteDefinition = { routes: [{ path: "/", component: AboutPage }] };`,
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(repo, "sites", `slot-${String(slot).padStart(6, "0")}`, "db", "migrations", "0000_init.sql"),
      `CREATE SCHEMA IF NOT EXISTS "slot_${String(slot).padStart(6, "0")}";\nCREATE TABLE "slot_${String(slot).padStart(6, "0")}"."cases" ("id" serial PRIMARY KEY);\n`,
      "utf8",
    );
    return repo;
  }

  it("extracts a fully detached project and marks the source manifest", () => {
    const repo = makeRepo(3);
    const dest = path.join(workDir, "client-portal");
    const plan = planExtraction(repo, 3, "client-portal", dest);
    const report = extractSlot(repo, plan);

    expect(report.manifestMarked).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(report.libsCopied).toContain("site-contract");
    expect(report.libsCopied).toContain("manifest"); // transitive via others
    expect(report.libsCopied).toContain("routes");

    const about = readFileSync(path.join(dest, "src", "site", "pages", "about.tsx"), "utf8");
    expect(about).toContain(`href="/contact"`); // URL rewritten
    expect(about).not.toContain("/s/3");

    const dispatcher = readFileSync(path.join(dest, "src", "app", "[[...path]]", "page.tsx"), "utf8");
    expect(dispatcher).toContain(`@/site/site`); // standalone shell wired

    const schema = readFileSync(path.join(dest, "src", "site", "db", "schema.ts"), "utf8");
    expect(schema).toContain(`pgSchema("public")`);
    expect(schema).not.toContain("slot_000003");

    const migration = readFileSync(path.join(dest, "src", "site", "db", "migrations", "0000_init.sql"), "utf8");
    expect(migration).toContain(`"public"."cases"`);

    const standaloneManifest = JSON.parse(readFileSync(path.join(dest, "src", "site", "manifest.json"), "utf8"));
    expect(standaloneManifest.database).toEqual({ mode: "standalone", schema: "public" });

    const pkg = JSON.parse(readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(pkg.name).toBe("client-portal");
    expect(pkg.dependencies.next).toBe("16.2.6");
    expect(pkg.dependencies).not.toHaveProperty(["tsx"]); // only what's needed

    // Source slot keeps its code + history, marked extracted with destination.
    const sourceManifest = loadSlotManifest(path.join(repo, "sites", "slot-000003"), 3);
    expect(sourceManifest.status).toBe("extracted");
    expect(sourceManifest.extraction?.destination).toBe(dest);
  });

  it("refuses invalid names, unregistered slots, and non-empty destinations", () => {
    const repo = makeRepo(8);
    expect(() => planExtraction(repo, 8, "Bad Name!")).toThrow(/Invalid standalone name/);
    expect(() => planExtraction(repo, 999, "ghost")).toThrow(/not registered/);
    const dest = path.join(workDir, "occupied");
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, "file.txt"), "x", "utf8");
    expect(() => planExtraction(repo, 8, "valid-name", dest)).toThrow(/not empty/);
  });
});
