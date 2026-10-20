/**
 * Minimal, deterministic route-pattern matcher shared by the platform
 * dispatcher and by extracted standalone websites.
 *
 * Supported pattern syntax:
 *   "/"                    root
 *   "/about"               static segment
 *   "/work/[slug]"         dynamic segment (decoded)
 *   "/docs/[...rest]"      catch-all segment (must be last)
 */

export type RouteSegment =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "catchall"; name: string };

const PARAM_RE = /^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/;
const CATCHALL_RE = /^\[\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\]$/;

/** Normalize a request path: strip query/hash, ensure leading slash, drop trailing slash. */
export function normalizePath(pathname: string): string {
  let p = pathname.split("?")[0].split("#")[0].trim();
  if (p === "") return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  // collapse duplicate slashes
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/** Compile a pattern into segments. Throws on malformed patterns. */
export function parsePattern(pattern: string): RouteSegment[] {
  const normalized = normalizePath(pattern);
  if (normalized === "/") return [];
  const raw = normalized.slice(1).split("/");
  return raw.map((seg, index) => {
    const catchall = CATCHALL_RE.exec(seg);
    if (catchall) {
      if (index !== raw.length - 1) {
        throw new Error(`Catch-all segment "${seg}" must be the last segment in "${pattern}"`);
      }
      return { kind: "catchall", name: catchall[1] };
    }
    const param = PARAM_RE.exec(seg);
    if (param) return { kind: "param", name: param[1] };
    if (seg.includes("[") || seg.includes("]") || seg === "") {
      throw new Error(`Invalid route segment "${seg}" in pattern "${pattern}"`);
    }
    return { kind: "static", value: seg };
  });
}

/**
 * Match a pathname against a pattern. Returns decoded params on success,
 * or null when it does not match.
 */
export function matchSegments(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const segments = parsePattern(pattern);
  const normalized = normalizePath(pathname);
  const parts = normalized === "/" ? [] : normalized.slice(1).split("/");
  const params: Record<string, string> = {};

  let i = 0;
  for (const segment of segments) {
    if (segment.kind === "catchall") {
      const rest = parts.slice(i);
      if (rest.length === 0) return null;
      params[segment.name] = rest.map((p) => safeDecode(p)).join("/");
      return params;
    }
    if (i >= parts.length) return null;
    const part = parts[i];
    if (segment.kind === "static") {
      if (segment.value !== part) return null;
    } else {
      params[segment.name] = safeDecode(part);
    }
    i += 1;
  }
  return i === parts.length ? params : null;
}

export interface RouteMatch<T> {
  route: T;
  params: Record<string, string>;
}

/** Specificity score so that "/work/new" beats "/work/[slug]" deterministically. */
function specificity(pattern: string): number {
  return parsePattern(pattern).reduce((score, seg) => {
    if (seg.kind === "static") return score + 100;
    if (seg.kind === "param") return score + 10;
    return score + 1;
  }, 0);
}

/**
 * Find the best matching route for a pathname among routes shaped like
 * `{ path: string }`. Routes are evaluated by descending specificity;
 * ties keep declaration order (stable).
 */
export function matchRoute<T extends { path: string }>(
  routes: readonly T[],
  pathname: string,
): RouteMatch<T> | null {
  const ordered = routes
    .map((route, index) => ({ route, index, score: specificity(route.path) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  for (const candidate of ordered) {
    const params = matchSegments(candidate.route.path, pathname);
    if (params) return { route: candidate.route, params };
  }
  return null;
}

/** Join site-internal API path segments ("a", "b") into a matchable key. */
export function apiPathFromSegments(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "/";
  return `/${segments.join("/")}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
