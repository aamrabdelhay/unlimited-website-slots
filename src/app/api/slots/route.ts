import registryIndexJson from "@/generated/registry.json";

/**
 * Read-only public index of registered websites (metadata only — never
 * environment variables or connection strings). Mutation is intentionally
 * impossible over HTTP; use the CLI scripts instead.
 */
export function GET() {
  return Response.json(registryIndexJson, {
    headers: { "cache-control": "no-store" },
  });
}
