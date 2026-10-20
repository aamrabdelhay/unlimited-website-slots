import { sql } from "drizzle-orm";
import { getSharedDb } from "@/db";

/**
 * Platform liveness. Always answers quickly; the database check is
 * best-effort and reported as a field instead of being required.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "connected" | "unconfigured" | "unreachable" = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      await getSharedDb().execute(sql`select 1`);
      database = "connected";
    } catch {
      database = "unreachable";
    }
  }
  return Response.json({
    ok: true,
    service: "unlimited-website-slots",
    database,
    timestamp: new Date().toISOString(),
  });
}
