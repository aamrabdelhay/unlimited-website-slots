import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { EnvLike, ResolvedDatabaseConfig } from "./db-config";

/**
 * Lazily-created, cached PostgreSQL pools keyed by connection string.
 * Nothing connects at import time, so pages and slots render fine without
 * any database configured — callers get a DatabaseConfigError only when
 * they actually ask for a connection.
 */

const pools = new Map<string, Pool>();
const databases = new Map<string, NodePgDatabase>();

function sslFor(env: EnvLike): { rejectUnauthorized: boolean } | undefined {
  // Neon / Supabase style connections need TLS; local Postgres does not.
  if (env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  return undefined;
}

export function getPool(config: ResolvedDatabaseConfig, env: EnvLike = process.env): Pool {
  const existing = pools.get(config.connectionString);
  if (existing) return existing;
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: sslFor(env),
    max: 5,
  });
  pools.set(config.connectionString, pool);
  return pool;
}

/** A Drizzle client bound to the slot's resolved pool. Always schema-scoped by callers via pgSchema tables. */
export function getDb(config: ResolvedDatabaseConfig, env: EnvLike = process.env): NodePgDatabase {
  const key = `${config.connectionString}::${config.schema}`;
  const existing = databases.get(key);
  if (existing) return existing;
  const db = drizzle(getPool(config, env));
  databases.set(key, db);
  return db;
}

/** Test/maintenance helper: close every cached pool. */
export async function closeAllPools(): Promise<void> {
  const all = [...pools.values()];
  pools.clear();
  databases.clear();
  await Promise.all(all.map((pool) => pool.end()));
}
