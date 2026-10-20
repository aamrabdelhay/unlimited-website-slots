import { getSlotEntry } from "@/generated/slot-registry";
import { parseSlotParam } from "@/lib/slot-ids";
import { apiPathFromSegments, matchRoute } from "@/lib/routes";
import { apiError, type HttpMethod } from "@/lib/site-contract";

/**
 * Slot API dispatcher: /api/s/N/<anything> resolves through the generated
 * registry and the site's own handler table. Handlers receive plain web
 * Request/Response objects, so identical code runs after extraction.
 */

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slot: string; path?: string[] }> };

async function dispatch(
  method: HttpMethod,
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { slot, path } = await context.params;

  const slotId = parseSlotParam(slot);
  if (slotId === null) {
    return apiError(404, "slot_not_found", `No website is registered at slot "${slot}".`);
  }
  const entry = getSlotEntry(slotId);
  if (!entry) {
    return apiError(404, "slot_not_found", `No website is registered at slot ${slotId}.`);
  }

  const apiRoutes = entry.site.api ?? [];
  const pathname = apiPathFromSegments(path);
  const match = matchRoute(apiRoutes, pathname);
  if (!match) {
    return apiError(404, "route_not_found", `This website exposes no API route at "${pathname}".`, {
      available: apiRoutes.map((route) => route.path),
    });
  }

  const handler = match.route.handlers[method];
  if (!handler) {
    const allowed = Object.keys(match.route.handlers).sort();
    const response = apiError(
      405,
      "method_not_allowed",
      `Method ${method} is not allowed on ${pathname}.`,
      { allowed },
    );
    response.headers.set("Allow", allowed.join(", "));
    return response;
  }

  try {
    return await handler(request, {
      slot: slotId,
      manifest: entry.manifest,
      params: match.params,
      method,
    });
  } catch (error) {
    // Never leak internals (and never log connection strings).
    console.error(`[slot ${slotId}] unhandled API error: ${(error as Error).name}`);
    return apiError(500, "internal_error", "The website failed to handle this request.");
  }
}

export function GET(request: Request, context: RouteContext) {
  return dispatch("GET", request, context);
}
export function POST(request: Request, context: RouteContext) {
  return dispatch("POST", request, context);
}
export function PUT(request: Request, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export function PATCH(request: Request, context: RouteContext) {
  return dispatch("PATCH", request, context);
}
export function DELETE(request: Request, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
