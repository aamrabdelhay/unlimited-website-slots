import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { resolveSlotDatabaseConfig, DatabaseConfigError } from "@/lib/db-config";
import { getDb } from "@/lib/slot-db";
import { parseManifest } from "@/lib/manifest";
import rawManifest from "../manifest.json";

const siteManifest = parseManifest(rawManifest);

/** This slot's validated database configuration (server-side only). */
export function siteDatabaseConfig() {
  return resolveSlotDatabaseConfig(siteManifest.slotId, siteManifest.database, process.env);
}

/** Lazily resolved Drizzle client, always scoped to this slot's schema tables. */
export function siteDb(): NodePgDatabase {
  return getDb(siteDatabaseConfig());
}

/** True when a connection string is configured (does not open a connection). */
export function hasDatabaseConfig(): boolean {
  try {
    siteDatabaseConfig();
    return true;
  } catch (error) {
    if (error instanceof DatabaseConfigError) return false;
    throw error;
  }
}
