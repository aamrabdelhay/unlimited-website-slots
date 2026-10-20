import { slotDirName, slotSchemaName, formatSlotId } from "../../src/lib/slot-ids";
import { createManifest, type SlotStatus } from "../../src/lib/manifest";

/**
 * Source scaffold for a brand-new slot. Everything a website needs lives
 * inside its own directory: pages, components, styles, api handlers, db
 * schema + migrations, and docs.
 */

export interface ScaffoldInput {
  slotId: number;
  name: string;
  description?: string;
  status?: SlotStatus;
  now?: string;
}

export function buildSlotScaffold(input: ScaffoldInput): Record<string, string> {
  const { slotId, name } = input;
  const description = input.description ?? "";
  const dirName = slotDirName(slotId);
  const schemaName = slotSchemaName(slotId);
  const displayId = formatSlotId(slotId);
  const manifest = createManifest({
    slotId,
    name,
    description,
    status: input.status ?? "empty",
    now: input.now,
  });

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

  const siteTsx = `import type { SiteDefinition } from "@/lib/site-contract";
import { HomePage } from "./pages/home";
import { siteStyles } from "./styles";

export const site: SiteDefinition = {
  routes: [
    {
      path: "/",
      component: HomePage,
      metadata: {
        title: ${JSON.stringify(name)},
        description: ${JSON.stringify(description || `Website in slot ${slotId}`)},
      },
    },
  ],
  api: [],
  styles: siteStyles,
};
`;

  const homePage = `import type { SitePageProps } from "@/lib/site-contract";
import { formatSlotId } from "@/lib/slot-ids";

/**
 * Default placeholder page for an empty slot.
 * Replace this with a real website — every file belongs exclusively to this
 * slot. Create pages under ./pages and register them in ./site.tsx.
 */
export function HomePage({ slot, manifest, basePath }: SitePageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-16 text-neutral-200">
      <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
          Slot {formatSlotId(slot)} · {manifest.status}
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{manifest.name}</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {manifest.description ||
            "This slot is empty. Ask the development agent to build a website here, or edit the source under its sites/ directory."}
        </p>
        <dl className="mt-8 space-y-2 border-t border-neutral-800 pt-6 font-mono text-xs text-neutral-500">
          <div className="flex justify-between">
            <dt>Public path</dt>
            <dd className="text-neutral-300">{basePath || "/"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>API base</dt>
            <dd className="text-neutral-300">/api{basePath}/</dd>
          </div>
          <div className="flex justify-between">
            <dt>Database schema</dt>
            <dd className="text-neutral-300">{manifest.database.schema ?? \`slot_\${String(slot).padStart(6, "0")}\`}</dd>
          </div>
        </dl>
        <p className="mt-8 font-mono text-xs text-neutral-600">
          npm run slots:reset -- --slot ${slotId} --dry-run
        </p>
      </section>
    </main>
  );
}
`;

  const styles = `/**
 * Raw CSS injected alongside this slot only. Use it for keyframes, custom
 * properties, and font smoothing. Layout/styling should primarily use
 * Tailwind utilities inside page + component files.
 */
export const siteStyles = /* css */ \`
  .slot-${slotId}-scope {
    color-scheme: dark;
  }
\`;
`;

  const libDb = `import type { NodePgDatabase } from "drizzle-orm/node-postgres";
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
`;

  const dbSchema = `import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Every table for this website lives in its own PostgreSQL schema.
 * In shared-database mode this is the ONLY schema this slot may touch.
 */
export const slotSchema = pgSchema("${schemaName}");

// Example:
// export const items = slotSchema.table("items", {
//   id: serial("id").primaryKey(),
//   createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
// });
`;

  const drizzleConfig = `import { defineConfig } from "drizzle-kit";

/**
 * Per-slot Drizzle configuration. Migrations only ever touch this slot's
 * schema. Usage (from the repo root):
 *   npm run slot:db -- --slot ${slotId} --cmd generate
 *   npm run slot:db -- --slot ${slotId} --cmd push
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  schemaFilter: ["${schemaName}"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
`;

  const readme = `# ${name} — slot ${displayId}

${description || "Empty website slot."}

- **Public URL (monorepo):** \`/s/${slotId}\`
- **API base (monorepo):** \`/api/s/${slotId}\`
- **Source:** \`sites/${dirName}/\`
- **Database:** shared mode, schema \`${schemaName}\` (owned exclusively by this slot)

## Build a website here

Ask the development agent, e.g.:

> "In slot ${slotId}, build a complete <kind of> website with <features>."

Or edit manually:

1. Add pages in \`pages/\` and register them in \`site.tsx\` (patterns like
   \`/\`, \`/about\`, \`/work/[slug]\`, \`/docs/[...rest]\`).
2. Add API handlers under \`api/\` (plain \`Request\`/\`Response\`) and register
   them in \`site.tsx\`.
3. Define tables in \`db/schema.ts\` — always inside \`slotSchema\`.
4. Run \`npm run registry:generate\` and \`npm run build\`.

## Database

\`\`\`bash
npm run slot:db -- --slot ${slotId} --cmd generate   # emit SQL from db/schema.ts
npm run slot:db -- --slot ${slotId} --cmd push       # apply to DATABASE_URL
\`\`\`

Dedicated database: set \`${dirName.replace(/-/g, "_").toUpperCase()}_DATABASE_URL\`
(or switch \`database.mode\` in \`manifest.json\` to \`"dedicated"\`).

## Safety

- Never import from another slot's directory.
- Reset safely: \`npm run slots:reset -- --slot ${slotId} --dry-run\`
- Extract: \`npm run slots:extract -- --slot ${slotId} --name my-site\`
`;

  return {
    "manifest.json": manifestJson,
    "site.tsx": siteTsx,
    "pages/home.tsx": homePage,
    "styles.ts": styles,
    "lib/db.ts": libDb,
    "db/schema.ts": dbSchema,
    "db/migrations/.gitkeep": "",
    "drizzle.config.ts": drizzleConfig,
    "README.md": readme,
    "api/.gitkeep": "",
  };
}
