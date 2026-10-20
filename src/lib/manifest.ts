import { z } from "zod";
import { isValidSlotId, slotSchemaName } from "./slot-ids";

/**
 * The single validated source of truth for per-website metadata.
 * Each slot stores this as `sites/slot-XXXXXX/manifest.json`.
 */

export const SLOT_STATUSES = ["empty", "in-use", "extracted"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const DATABASE_MODES = ["shared", "dedicated", "standalone"] as const;
export type DatabaseMode = (typeof DATABASE_MODES)[number];

const schemaIdentifier = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*$/, "Must be a safe lowercase SQL identifier");

export const databaseConfigSchema = z.object({
  /**
   * shared     -> DATABASE_URL, schema derived from the slot id (slot_XXXXXX)
   * dedicated  -> SLOT_XXXXXX_DATABASE_URL (its own database), manifest schema
   * standalone -> produced by extraction; DATABASE_URL, public schema
   */
  mode: z.enum(DATABASE_MODES).default("shared"),
  schema: schemaIdentifier.optional(),
});

export const extractionRecordSchema = z.object({
  destination: z.string().min(1),
  extractedAt: z.iso.datetime(),
});

export const slotManifestSchema = z.object({
  slotId: z
    .number()
    .int()
    .positive()
    .refine(isValidSlotId, "slotId must be a positive safe integer"),
  name: z.string().min(1).max(120),
  description: z.string().max(600).default(""),
  status: z.enum(SLOT_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  database: databaseConfigSchema.default({ mode: "shared" }),
  notes: z.string().max(2000).default(""),
  extraction: extractionRecordSchema.nullable().default(null),
});

export type SlotManifest = z.infer<typeof slotManifestSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

/** Parse + validate a manifest; throws a descriptive error on failure. */
export function parseManifest(data: unknown, source = "manifest"): SlotManifest {
  const result = slotManifestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid ${source}: ${issues}`);
  }
  return result.data;
}

/**
 * Resolve the trusted schema identifier for a manifest.
 * Shared mode ALWAYS derives the schema from the slot id so a request can
 * never smuggle a foreign schema name through manifest fields.
 */
export function resolveSchemaName(manifest: SlotManifest): string {
  if (manifest.database.mode === "standalone") return "public";
  if (manifest.database.mode === "dedicated") {
    return manifest.database.schema ?? slotSchemaName(manifest.slotId);
  }
  return slotSchemaName(manifest.slotId);
}

/** Shape of the generated registry index (`registry.json`). */
export const registryIndexSchema = z.object({
  generatedAt: z.string(),
  slots: z.array(
    slotManifestSchema.extend({
      dirName: z.string().regex(/^slot-\d{6,}$/),
      basePath: z.string().startsWith("/s/"),
      apiBasePath: z.string().startsWith("/api/s/"),
    }),
  ),
});
export type RegistryIndexEntry = z.infer<typeof registryIndexSchema>["slots"][number];
export type RegistryIndex = z.infer<typeof registryIndexSchema>;

/** Create a fresh manifest for a newly created slot. */
export function createManifest(input: {
  slotId: number;
  name: string;
  description?: string;
  status?: SlotStatus;
  now?: string;
}): SlotManifest {
  const now = input.now ?? new Date().toISOString();
  return slotManifestSchema.parse({
    slotId: input.slotId,
    name: input.name,
    description: input.description ?? "",
    status: input.status ?? "empty",
    createdAt: now,
    updatedAt: now,
    database: { mode: "shared", schema: slotSchemaName(input.slotId) },
    notes: "",
    extraction: null,
  });
}
