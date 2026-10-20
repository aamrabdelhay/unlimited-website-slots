import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Shared-platform database accessor. Lazily created so importing this
 * module never requires DATABASE_URL — the app must build and render the
 * dashboard even with no database configured. Callers get a clear error
 * only when they actually request a connection.
 */

let pool: Pool | undefined;
let database: NodePgDatabase | undefined;

export function getSharedPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set — configure the shared PostgreSQL connection first.",
    );
  }
  pool ??= new Pool({ connectionString: databaseUrl });
  return pool;
}

export function getSharedDb(): NodePgDatabase {
  database ??= drizzle(getSharedPool());
  return database;
}
