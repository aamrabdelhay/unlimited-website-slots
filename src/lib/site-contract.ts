import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { SlotManifest } from "./manifest";

/**
 * The stable website contract between the platform dispatcher and the
 * independently maintained website source projects under `sites/`.
 *
 * A slot exports a single `SiteDefinition` from `sites/slot-XXXXXX/site.tsx`
 * (or `site.ts`). The registry generator statically imports these modules so
 * production bundlers can discover every route without dynamic filesystem
 * access.
 */

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Props every site page component receives from the dispatcher. */
export interface SitePageProps {
  /** Validated numeric slot id (e.g. 3). */
  slot: number;
  /** Trusted, validated manifest for this slot. */
  manifest: SlotManifest;
  /** Dynamic route params extracted from the matched pattern. */
  params: Record<string, string>;
  /** Query string values from the incoming request. */
  searchParams: Record<string, string | string[] | undefined>;
  /** Public base path of the site: "/s/3" in the monorepo, "" once extracted. */
  basePath: string;
}

export type SiteComponent = (props: SitePageProps) => ReactNode | Promise<ReactNode>;

export interface SiteRouteContext {
  slot: number;
  manifest: SlotManifest;
  params: Record<string, string>;
  basePath: string;
}

export interface SiteRoute {
  /** Pattern such as "/", "/about", "/work/[slug]" or "/docs/[...rest]". */
  path: string;
  component: SiteComponent;
  metadata?: Metadata | ((ctx: SiteRouteContext) => Metadata | Promise<Metadata>);
}

export interface SlotApiContext {
  slot: number;
  manifest: SlotManifest;
  params: Record<string, string>;
  method: HttpMethod;
}

/**
 * Slot API handlers use plain web-standard Request/Response so the exact
 * same handler code runs in the monorepo dispatcher and in an extracted
 * standalone Next.js application.
 */
export type SlotApiHandler = (
  request: Request,
  ctx: SlotApiContext,
) => Response | Promise<Response>;

export interface SiteApiRoute {
  /** Pattern relative to the site: "/health", "/messages", "/notes/[id]". */
  path: string;
  handlers: Partial<Record<HttpMethod, SlotApiHandler>>;
}

export interface SiteDefinition {
  routes: SiteRoute[];
  api?: SiteApiRoute[];
  /**
   * Optional raw CSS injected with the site (keyframes, custom properties).
   * Per-slot `globals.css` control (body fonts, html dir/lang) is a known
   * dispatcher limitation — extract the slot for full document control.
   */
  styles?: string;
}

/** Build a JSON response with a correct content type. */
export function apiJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/** Standardized error payload for slot APIs. */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { ok: false, error: { code, message, ...(extra ?? {}) } },
    { status },
  );
}
