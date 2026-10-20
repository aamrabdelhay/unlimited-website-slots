import {
  isValidSlotId,
  slotDatabaseEnvVar,
  slotSchemaName,
} from "./slot-ids";
import type { DatabaseConfig } from "./manifest";

/**
 * Server-side resolution of per-slot database configuration.
 *
 * Connection precedence:
 *   1. SLOT_XXXXXX_DATABASE_URL  (per-slot dedicated connection, if set)
 *   2. DATABASE_URL              (shared platform connection)
 *
 * Schema selection (never influenced by request data):
 *   - shared mode     -> schema derived from the validated slot id
 *   - dedicated mode  -> schema from the trusted manifest (defaults to slot id schema)
 *   - standalone mode -> "public" (produced by extraction)
 */

export type EnvLike = Record<string, string | undefined>;

export const STANDALONE_SCHEMA = "public";

export class DatabaseConfigError extends Error {
  readonly code:
    | "invalid-slot"
    | "missing-shared-url"
    | "missing-dedicated-url";
  constructor(code: DatabaseConfigError["code"], message: string) {
    super(message);
    this.name = "DatabaseConfigError";
    this.code = code;
  }
}

export interface ResolvedDatabaseConfig {
  mode: DatabaseConfig["mode"];
  connectionString: string;
  schema: string;
  /** Name of the env var the connection string came from (never the value). */
  sourceEnvVar: string;
}

/**
 * Resolve where a slot's data lives. `database` must come from a validated
 * manifest (or be omitted to assume shared defaults). The slot schema in
 * shared mode is ALWAYS derived from the slot id.
 */
export function resolveSlotDatabaseConfig(
  slot: number,
  database: DatabaseConfig | null | undefined,
  env: EnvLike = process.env,
): ResolvedDatabaseConfig {
  if (!isValidSlotId(slot)) {
    throw new DatabaseConfigError(
      "invalid-slot",
      `Cannot resolve a database for invalid slot id "${String(slot)}".`,
    );
  }

  const mode = database?.mode ?? "shared";
  const dedicatedVar = slotDatabaseEnvVar(slot);
  const dedicatedUrl = env[dedicatedVar];
  const sharedUrl = env.DATABASE_URL;

  if (mode === "standalone") {
    if (dedicatedUrl) {
      return { mode, connectionString: dedicatedUrl, schema: STANDALONE_SCHEMA, sourceEnvVar: dedicatedVar };
    }
    if (sharedUrl) {
      return { mode, connectionString: sharedUrl, schema: STANDALONE_SCHEMA, sourceEnvVar: "DATABASE_URL" };
    }
    throw new DatabaseConfigError(
      "missing-shared-url",
      `Standalone slot ${slot} needs DATABASE_URL or ${dedicatedVar} to connect.`,
    );
  }

  if (mode === "dedicated") {
    if (!dedicatedUrl) {
      throw new DatabaseConfigError(
        "missing-dedicated-url",
        `Slot ${slot} is in dedicated mode but ${dedicatedVar} is not set.`,
      );
    }
    // Schema comes from trusted manifest data only; default to the derived one.
    const schema = database?.schema ?? slotSchemaName(slot);
    return { mode, connectionString: dedicatedUrl, schema, sourceEnvVar: dedicatedVar };
  }

  // shared mode
  const schema = slotSchemaName(slot);
  if (dedicatedUrl) {
    // An explicit per-slot URL wins even in shared mode (documented precedence).
    return { mode, connectionString: dedicatedUrl, schema, sourceEnvVar: dedicatedVar };
  }
  if (!sharedUrl) {
    throw new DatabaseConfigError(
      "missing-shared-url",
      `Slot ${slot} is in shared mode but DATABASE_URL is not set.`,
    );
  }
  return { mode, connectionString: sharedUrl, schema, sourceEnvVar: "DATABASE_URL" };
}

/** The env var a dedicated slot connection should be read from. */
export function dedicatedSlotEnvVar(slot: number): string {
  return slotDatabaseEnvVar(slot);
}
