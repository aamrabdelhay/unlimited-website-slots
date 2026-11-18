import { get, put } from "@vercel/blob";

export interface CustomLink {
  id: string;
  label: string;
  slug: string;
  target: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = "unlimited/custom-links.json";

export const DEFAULT_CUSTOM_LINKS: CustomLink[] = [
  { id: "default-snake", label: "لعبة Snake Evolution", slug: "snake", target: "/snake-evolution.html", enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "default-algebra", label: "مرافعات تنفيذ جبري", slug: "algebra", target: "/marafeat-tanfiz.html", enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "default-zakerti", label: "ذاكرتي", slug: "zakerti", target: "/zakerti.html", enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

function isCustomLink(value: unknown): value is CustomLink {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CustomLink>;
  return typeof item.id === "string" &&
    typeof item.label === "string" &&
    typeof item.slug === "string" &&
    typeof item.target === "string" &&
    typeof item.enabled === "boolean" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string";
}

export function validateSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 48) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export function validateTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const target = value.trim();
  if (!target || target.length > 200 || !target.startsWith("/") || target.startsWith("//")) return null;
  if (target.includes("\\") || target.includes("?") || target.includes("#")) return null;
  let parsed: URL;
  try {
    parsed = new URL(target, "https://unlimited.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "https://unlimited.invalid") return null;
  if (parsed.pathname === "/admin" || parsed.pathname.startsWith("/admin/")) return null;
  if (parsed.pathname === "/api" || parsed.pathname.startsWith("/api/")) return null;
  if (/^\/www\./i.test(parsed.pathname)) return null;
  if (parsed.pathname.split("/").some((part) => part === "." || part === "..")) return null;
  return parsed.pathname;
}

export async function readCustomLinks(): Promise<CustomLink[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return DEFAULT_CUSTOM_LINKS;
  const result = await get(STORE_PATH, { access: "private", useCache: false });
  if (!result) return DEFAULT_CUSTOM_LINKS;
  const raw = await new Response(result.stream).text();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { links?: unknown }).links)) {
    throw new Error("The custom links store contains invalid data.");
  }
  const links = (parsed as { links: unknown[] }).links;
  if (!links.every(isCustomLink)) throw new Error("The custom links store contains an invalid link record.");
  return links;
}

export async function saveCustomLinks(links: CustomLink[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  await put(STORE_PATH, JSON.stringify({ version: 1, links }), {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getCustomLinkBySlug(slug: string): Promise<CustomLink | null> {
  const normalized = slug.toLowerCase();
  const links = await readCustomLinks();
  return links.find((link) => link.slug === normalized && link.enabled) ?? null;
}