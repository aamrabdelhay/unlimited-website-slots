import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("private Blob operation budget", () => {
  it("lists legacy records only during the one-time consolidation migration", () => {
    const source = readFileSync(
      path.resolve("sites/slot-000001/api/cars.ts"),
      "utf8",
    );

    const listCallSites = source
      .split("\n")
      .filter((line) => /^\s*const page = await list\(/.test(line));
    expect(listCallSites).toHaveLength(1);
    expect(source).toContain("async function importLegacyState");
    expect(source).toContain("records-v1.json");
    expect(source).toContain("ifMatch: expectedEtag");
    expect(source).toContain("allowOverwrite: Boolean(expectedEtag)");
  });

  it("retains the original encryption derivation for legacy records", () => {
    const source = readFileSync(
      path.resolve("sites/slot-000001/api/cars.ts"),
      "utf8",
    );

    expect(source).toContain("iavs-private-records-v1:");
    expect(source).toContain("update(storageToken)");
    expect(source).toMatch(/legacy files are intentionally retained/i);
  });
});
