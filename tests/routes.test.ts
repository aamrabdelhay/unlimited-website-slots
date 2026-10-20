import { describe, expect, it } from "vitest";
import {
  apiPathFromSegments,
  matchRoute,
  matchSegments,
  normalizePath,
  parsePattern,
} from "../src/lib/routes";

describe("path normalization", () => {
  it("normalizes slashes, query strings, and trailing slashes", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/about/")).toBe("/about");
    expect(normalizePath("about")).toBe("/about");
    expect(normalizePath("/work/x?y=1#z")).toBe("/work/x");
    expect(normalizePath("//a///b")).toBe("/a/b");
    expect(normalizePath("")).toBe("/");
  });
});

describe("segment matching", () => {
  it("matches static routes exactly", () => {
    expect(matchSegments("/", "/")).toEqual({});
    expect(matchSegments("/", "")).toEqual({});
    expect(matchSegments("/about", "/about")).toEqual({});
    expect(matchSegments("/about", "/contact")).toBeNull();
    expect(matchSegments("/about", "/about/team")).toBeNull();
    expect(matchSegments("/about", "/ABOUT")).toBeNull();
  });

  it("matches dynamic params and decodes them", () => {
    expect(matchSegments("/work/[slug]", "/work/courtyard-house")).toEqual({
      slug: "courtyard-house",
    });
    expect(matchSegments("/work/[slug]", "/work")).toBeNull();
    expect(matchSegments("/work/[slug]", "/work/a/b")).toBeNull();
    expect(matchSegments("/notes/[id]", "/notes/hello%20world")).toEqual({
      id: "hello world",
    });
  });

  it("matches catch-alls only at the end", () => {
    expect(matchSegments("/docs/[...rest]", "/docs/a/b/c")).toEqual({ rest: "a/b/c" });
    expect(matchSegments("/docs/[...rest]", "/docs")).toBeNull();
    expect(() => parsePattern("/[...rest]/tail")).toThrow(/last segment/);
    expect(() => parsePattern("/a/[]")).toThrow(/Invalid route segment/);
    expect(() => parsePattern("/a/[1bad]")).toThrow(/Invalid route segment/);
  });
});

describe("route table matching with specificity", () => {
  const routes = [
    { path: "/" },
    { path: "/work" },
    { path: "/work/[slug]" },
    { path: "/work/new" },
    { path: "/api/[...rest]" },
  ];

  it("prefers static over dynamic deterministically", () => {
    expect(matchRoute(routes, "/work/new")?.route.path).toBe("/work/new");
    expect(matchRoute(routes, "/work/other")?.route.path).toBe("/work/[slug]");
    expect(matchRoute(routes, "/work")?.route.path).toBe("/work");
    expect(matchRoute(routes, "/")?.route.path).toBe("/");
  });

  it("returns null when nothing matches", () => {
    expect(matchRoute(routes, "/nope")).toBeNull();
  });

  it("builds api path keys from segments", () => {
    expect(apiPathFromSegments(undefined)).toBe("/");
    expect(apiPathFromSegments([])).toBe("/");
    expect(apiPathFromSegments(["messages"])).toBe("/messages");
    expect(apiPathFromSegments(["notes", "3"])).toBe("/notes/3");
  });
});
