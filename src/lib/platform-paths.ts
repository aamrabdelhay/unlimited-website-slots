/** Small URL helpers shared by dashboard, slots, and extraction rewrites. */

/** Public base path of a slot site inside the monorepo: 3 -> "/s/3". */
export function slotBasePath(slot: number): string {
  return `/s/${slot}`;
}

/** Public path inside a slot site: (3, "/about") -> "/s/3/about". */
export function slotPublicPath(slot: number, path = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? slotBasePath(slot) : `${slotBasePath(slot)}${normalized}`;
}

/** Public API path inside a slot site: (3, "/messages") -> "/api/s/3/messages". */
export function slotApiPath(slot: number, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/s/${slot}${normalized}`;
}
