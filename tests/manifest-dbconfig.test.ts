import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createManifest,
  parseManifest,
  registryIndexSchema,
  resolveSchemaName,
} from "../src/lib/manifest";
import { DatabaseConfigError, resolveSlotDatabaseConfig } from "../src/lib/db-config";

const NOW = "2026-01-02T03:04:05.000Z";

describe("manifest validation", () => {
  it("creates deterministic manifests and derives the shared schema from the slot id", () => {
    const manifest = createManifest({ slotId: 127, name: "Arabic Academy", now: NOW });
    expect(manifest.slotId).toBe(127);
    expect(manifest.status).toBe("empty");
    expect(manifest.createdAt).toBe(NOW);
    expect(manifest.updatedAt).toBe(NOW);
    expect(manifest.database).toEqual({ mode: "shared", schema: "slot_000127" });
    expect(manifest.extraction).toBeNull();
  });

  it("rejects invalid statuses, ids, and schema identifiers with clear errors", () => {
    expect(() =>
      parseManifest({ slotId: 1, name: "X", status: "hacked", createdAt: NOW, updatedAt: NOW }),
    ).toThrow(/Invalid/);
    expect(() => createManifest({ slotId: 0, name: "Zero" })).toThrow();
    expect(() =>
      parseManifest({
        slotId: 1, name: "X", status: "empty", createdAt: NOW, updatedAt: NOW,
        database: { mode: "dedicated", schema: "bad-schema!" },
      }),
    ).toThrow(/Invalid/);
  });

  it("shared mode schema is ALWAYS derived from the slot id, never from manifest fields", () => {
    const manifest = createManifest({ slotId: 3, name: "Law", now: NOW });
    manifest.database.schema = "public"; // tampered value
    expect(resolveSchemaName(manifest)).toBe("slot_000003");
  });

  it("dedicated mode uses the manifest schema; standalone forces public", () => {
    const dedicated = createManifest({ slotId: 4, name: "D", now: NOW });
    dedicated.database = { mode: "dedicated", schema: "client_portal" };
    expect(resolveSchemaName(dedicated)).toBe("client_portal");

    const standalone = createManifest({ slotId: 4, name: "D", now: NOW });
    standalone.database = { mode: "standalone", schema: "public" };
    expect(resolveSchemaName(standalone)).toBe("public");
  });
});

describe("database configuration resolution (cross-slot isolation by construction)", () => {
  const db = { mode: "shared", schema: "slot_000003" } as const;

  it("shared mode uses DATABASE_URL and the derived slot schema", () => {
    const config = resolveSlotDatabaseConfig(3, db, { DATABASE_URL: "postgres://shared/db" });
    expect(config).toMatchObject({
      mode: "shared",
      connectionString: "postgres://shared/db",
      schema: "slot_000003",
      sourceEnvVar: "DATABASE_URL",
    });
  });

  it("SLOT_XXXXXX_DATABASE_URL takes documented precedence", () => {
    const config = resolveSlotDatabaseConfig(3, db, {
      DATABASE_URL: "postgres://shared/db",
      SLOT_000003_DATABASE_URL: "postgres://own/db",
    });
    expect(config.connectionString).toBe("postgres://own/db");
    expect(config.sourceEnvVar).toBe("SLOT_000003_DATABASE_URL");
    expect(config.schema).toBe("slot_000003");
  });

  it("slot 3 can never resolve slot 4's URL or schema", () => {
    const config = resolveSlotDatabaseConfig(3, db, {
      DATABASE_URL: "postgres://shared/db",
      SLOT_000004_DATABASE_URL: "postgres://other/db",
    });
    expect(config.connectionString).toBe("postgres://shared/db");
    expect(config.schema).toBe("slot_000003");
  });

  it("dedicated mode requires its own URL", () => {
    expect(() =>
      resolveSlotDatabaseConfig(5, { mode: "dedicated", schema: "client_x" }, { DATABASE_URL: "postgres://shared/db" }),
    ).toThrowError(expect.objectContaining({ code: "missing-dedicated-url" }) as never);
    const config = resolveSlotDatabaseConfig(5, { mode: "dedicated", schema: "client_x" }, {
      SLOT_000005_DATABASE_URL: "postgres://own/db",
    });
    expect(config.schema).toBe("client_x");
  });

  it("standalone mode resolves to public via any available URL", () => {
    const config = resolveSlotDatabaseConfig(9, { mode: "standalone", schema: "public" }, {
      DATABASE_URL: "postgres://shared/db",
    });
    expect(config.schema).toBe("public");
    expect(config.connectionString).toBe("postgres://shared/db");
  });

  it("fails clearly (never silently) when nothing is configured", () => {
    let caught: unknown;
    try {
      resolveSlotDatabaseConfig(7, db, {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DatabaseConfigError);
    expect((caught as DatabaseConfigError).code).toBe("missing-shared-url");
  });

  it("rejects invalid slot ids", () => {
    expect(() => resolveSlotDatabaseConfig(0, db, { DATABASE_URL: "x" })).toThrow(DatabaseConfigError);
  });
});

describe("generated registry indexes", () => {
  it("root registry.json parses and matches src/generated/registry.json", () => {
    const root = JSON.parse(readFileSync(path.resolve("registry.json"), "utf8"));
    const generated = JSON.parse(readFileSync(path.resolve("src/generated/registry.json"), "utf8"));
    const parsed = registryIndexSchema.parse(root);
    expect(parsed.slots.length).toBeGreaterThan(0);
    expect(root).toEqual(generated); // single source of truth, no drift
    for (const slot of parsed.slots) {
      expect(slot.basePath).toBe(`/s/${slot.slotId}`);
      expect(slot.slotId).toBeGreaterThan(0);
    }
  });
});
