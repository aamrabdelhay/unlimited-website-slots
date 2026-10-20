import { apiJson, type SlotApiHandler } from "@/lib/site-contract";
import { hasDatabaseConfig } from "../lib/db";

/** /api/s/1/health — liveness without touching the database. */
export const getHealth: SlotApiHandler = async (_request, ctx) => {
  return apiJson({
    ok: true,
    slot: ctx.slot,
    site: ctx.manifest.name,
    databaseConfigured: hasDatabaseConfig(),
    timestamp: new Date().toISOString(),
  });
};
