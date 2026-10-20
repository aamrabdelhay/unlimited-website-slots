import { describe, expect, it } from "vitest";
import {
  formatSlotId,
  isValidSlotId,
  parseSlotDirName,
  parseSlotId,
  parseSlotParam,
  slotDatabaseEnvVar,
  slotDirName,
  slotSchemaName,
} from "../src/lib/slot-ids";

describe("slot ids — unlimited by design", () => {
  it("accepts any positive safe integer, including sparse ids", () => {
    for (const id of [1, 3, 127, 10_000, 999_999, 1_000_000, 9_007_199_254_740_991]) {
      expect(isValidSlotId(id)).toBe(true);
    }
  });

  it("rejects non-positive, non-integer, and unsafe values", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "abc", "3.5", "-2", null, undefined, {}]) {
      expect(isValidSlotId(bad)).toBe(false);
      expect(parseSlotId(bad as never)).toBeNull();
    }
    // Type-strict guard: isValidSlotId never coerces, parseSlotId accepts
    // numeric strings by design (CLI/route input).
    expect(isValidSlotId("3")).toBe(false);
    expect(parseSlotId("3")).toBe(3);
  });

  it("parses numeric strings and rejects junk", () => {
    expect(parseSlotId("127")).toBe(127);
    expect(parseSlotId(" 42 ")).toBe(42);
    expect(parseSlotId("007")).toBe(7);
    expect(parseSlotId("12.5")).toBeNull();
    expect(parseSlotId("-4")).toBeNull();
    expect(parseSlotId("slot-127")).toBeNull(); // not the param grammar
    expect(parseSlotId("1e3")).toBeNull();
  });

  it("parses public route params in both plain and directory form", () => {
    expect(parseSlotParam("1")).toBe(1);
    expect(parseSlotParam("127")).toBe(127);
    expect(parseSlotParam("slot-000127")).toBe(127);
    expect(parseSlotParam("slot-010000")).toBe(10_000);
    expect(parseSlotParam("slot-10000")).toBeNull(); // 5 digits — not the padded grammar
    expect(parseSlotParam("slot-12")).toBeNull(); // too short — not our grammar
    expect(parseSlotParam("slot-abc")).toBeNull();
    expect(parseSlotParam("")).toBeNull();
  });

  it("normalizes directory, schema, and env-var names consistently", () => {
    expect(slotDirName(1)).toBe("slot-000001");
    expect(slotDirName(127)).toBe("slot-000127");
    expect(slotDirName(10_000)).toBe("slot-010000");
    expect(slotDirName(1_000_000)).toBe("slot-1000000"); // wider than pad, still valid

    expect(slotSchemaName(3)).toBe("slot_000003");
    expect(slotDatabaseEnvVar(3)).toBe("SLOT_000003_DATABASE_URL");

    expect(parseSlotDirName("slot-000127")).toBe(127);
    expect(parseSlotDirName("slot-1000000")).toBe(1_000_000);
    expect(parseSlotDirName("other")).toBeNull();
  });

  it("round-trips dirName <-> id and never renumbers", () => {
    for (const id of [1, 2, 3, 127, 10_000]) {
      expect(parseSlotDirName(slotDirName(id))).toBe(id);
    }
  });

  it("throws on invalid ids for derived names", () => {
    expect(() => slotDirName(0)).toThrow(RangeError);
    expect(() => slotSchemaName(-2)).toThrow(RangeError);
    expect(() => slotDatabaseEnvVar(1.5)).toThrow(RangeError);
  });

  it("formats display ids", () => {
    expect(formatSlotId(127)).toBe("#000127");
  });
});
