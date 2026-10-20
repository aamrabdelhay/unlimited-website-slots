import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { slotSchemaName, slotDirName } from "../../src/lib/slot-ids";
import { atomicWriteFile, loadRegisteredSites, writeManifest } from "./slots-core";
import type { SlotManifest } from "../../src/lib/manifest";

/**
 * Slot extraction engine: clone a website out of `sites/slot-XXXXXX` into a
 * standalone Next.js project with its own config, database wiring, and no
 * dependency on the central registry or other slots.
 */

// ---------------------------------------------------------------------------
// Pure, unit-tested transforms
// ---------------------------------------------------------------------------

const BOUNDARY = `(?=[/?#"'\\x60\\s)\\]]|$)`;

/**
 * Rewrite monorepo site URLs for standalone use.
 *   /api/s/3/messages -> /api/messages
 *   /s/3/about        -> /about
 * Boundary-aware so "/s/127" is never mangled when rewriting slot 1.
 */
export function rewriteSlotUrls(content: string, slot: number): string {
  const apiPattern = new RegExp(`/api/s/${slot}${BOUNDARY}`, "g");
  const sitePattern = new RegExp(`/s/${slot}${BOUNDARY}`, "g");
  return content.replace(apiPattern, "/api").replace(sitePattern, "");
}

const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Statement-head-aware rewrite of a pg_dump data file from one schema to
 * another. Only INSERT INTO table refs, COPY table refs, setval sequence
 * names, and SET search_path lines are touched — row data (including string
 * literals that merely mention the schema name) stays byte-identical.
 */
export function transformPgDumpData(
  input: string,
  fromSchema: string,
  toSchema: string,
): string {
  if (!SQL_IDENTIFIER.test(fromSchema) || !SQL_IDENTIFIER.test(toSchema)) {
    throw new Error(`Unsafe schema identifier(s): "${fromSchema}" -> "${toSchema}"`);
  }

  const quotedFrom = `"${fromSchema}".`;
  const tableRef = new RegExp(
    `^(\\s*(?:INSERT\\s+INTO|COPY)\\s+)(?:"${fromSchema}"\\.|${fromSchema}\\.)`,
    "i",
  );
  const setvalRef = new RegExp(
    `(setval\\(\\s*')(?:"${fromSchema}"\\.|${fromSchema}\\.)`,
    "gi",
  );

  return input
    .split("\n")
    .map((line) => {
      if (/^\s*SET\s+search_path/i.test(line)) {
        return `SET search_path TO ${toSchema}, pg_catalog;`;
      }
      if (/^\s*(INSERT\s+INTO|COPY)\s+/i.test(line)) {
        // Replace only the leading table reference, never the VALUES payload.
        if (line.slice(0, 200).includes(quotedFrom)) {
          return line.replace(quotedFrom, `"${toSchema}".`);
        }
        const match = tableRef.exec(line);
        if (match) {
          const rest = line.slice(match[0].length);
          return `${match[1]}"${toSchema}".${rest}`;
        }
        return line;
      }
      if (/setval\s*\(/i.test(line)) {
        return line.replace(setvalRef, `$1"${toSchema}".`);
      }
      return line;
    })
    .join("\n");
}

/**
 * Rewrite trusted, hand-authored DDL/migration SQL to a new schema. Safe to
 * apply broadly because (unlike data dumps) these files contain only DDL.
 */
export function rewriteDdlSchema(input: string, fromSchema: string, toSchema: string): string {
  if (!SQL_IDENTIFIER.test(fromSchema) || !SQL_IDENTIFIER.test(toSchema)) {
    throw new Error(`Unsafe schema identifier(s): "${fromSchema}" -> "${toSchema}"`);
  }
  return input
    .replaceAll(`"${fromSchema}"`, `"${toSchema}"`)
    .replace(new RegExp(`\\b${fromSchema}\\.`, "g"), `${toSchema}.`);
}

/** Count INSERT rows per schema.table in a dump (reporting/verification). */
export function tablesInDump(sql: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of sql.split("\n")) {
    const match = /^\s*INSERT\s+INTO\s+(?:"?([\w]+)"?\.)?"?([\w]+)"?\s/i.exec(line);
    if (match) {
      const table = `${match[1] ?? "public"}.${match[2]}`;
      counts.set(table, (counts.get(table) ?? 0) + 1);
    }
  }
  return counts;
}

/** Rewrite the pgSchema() call in a Drizzle schema source file. */
export function rewriteDrizzleSchemaCall(input: string, fromSchema: string, toSchema: string): string {
  return input
    .replaceAll(`pgSchema("${fromSchema}")`, `pgSchema("${toSchema}")`)
    .replaceAll(`pgSchema('${fromSchema}')`, `pgSchema('${toSchema}')`);
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".css", ".sql", ".txt", "",
]);

export interface ExtractPlan {
  slot: number;
  name: string;
  destDir: string;
  sourceDir: string;
}

export interface ExtractReport {
  filesCopied: number;
  libsCopied: string[];
  checks: { name: string; passed: boolean; detail?: string }[];
  manifestMarked: boolean;
  destDir: string;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function standalonePackageJson(name: string, monorepoPkg: Record<string, Record<string, string>>): string {
  const deps = monorepoPkg.dependencies ?? {};
  const devDeps = monorepoPkg.devDependencies ?? {};
  const pick = (source: Record<string, string>, keys: string[]) =>
    Object.fromEntries(
      keys.filter((key) => source[key]).map((key) => [key, source[key]]),
    );
  return `${JSON.stringify(
    {
      name,
      private: true,
      version: "0.1.0",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        typecheck: "tsc --noEmit",
        "db:generate": "drizzle-kit generate",
        "db:push": "drizzle-kit push",
      },
      dependencies: pick(deps, ["next", "react", "react-dom", "drizzle-orm", "pg", "zod", "lucide-react"]),
      devDependencies: pick(devDeps, [
        "typescript", "@types/node", "@types/react", "@types/react-dom", "@types/pg",
        "tailwindcss", "@tailwindcss/postcss", "postcss", "drizzle-kit",
      ]),
    },
    null,
    2,
  )}\n`;
}

const STANDALONE_DISPATCHER_PAGE = `import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { matchRoute, normalizePath } from "@/lib/routes";
import { parseManifest } from "@/lib/manifest";
import { site } from "@/site/site";
import rawManifest from "@/site/manifest.json";

const manifest = parseManifest(rawManifest);

type RouteParams = { path?: string[] };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { path } = await params;
  const pathname = normalizePath(\`/\${(path ?? []).join("/")}\`);
  const fallback: Metadata = { title: manifest.name, description: manifest.description || undefined };
  const match = matchRoute(site.routes, pathname);
  if (!match || !match.route.metadata) return fallback;
  const provided =
    typeof match.route.metadata === "function"
      ? await match.route.metadata({ slot: 1, manifest, params: match.params, basePath: "" })
      : match.route.metadata;
  return { ...fallback, ...provided };
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const pathname = normalizePath(\`/\${(path ?? []).join("/")}\`);
  const match = matchRoute(site.routes, pathname);
  if (!match) notFound();
  const Component = match.route.component;
  return (
    <>
      {site.styles ? <style dangerouslySetInnerHTML={{ __html: site.styles }} /> : null}
      <Component
        slot={1}
        manifest={manifest}
        params={match.params}
        searchParams={await searchParams}
        basePath=""
      />
    </>
  );
}
`;

const STANDALONE_API_ROUTE = `import { apiPathFromSegments, matchRoute } from "@/lib/routes";
import { apiError, type HttpMethod } from "@/lib/site-contract";
import { parseManifest } from "@/lib/manifest";
import { site } from "@/site/site";
import rawManifest from "@/site/manifest.json";

const manifest = parseManifest(rawManifest);

type RouteContext = { params: Promise<{ path?: string[] }> };

async function dispatch(method: HttpMethod, request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const apiRoutes = site.api ?? [];
  const pathname = apiPathFromSegments(path);
  const match = matchRoute(apiRoutes, pathname);
  if (!match) {
    return apiError(404, "route_not_found", \`No API route at "\${pathname}".\`);
  }
  const handler = match.route.handlers[method];
  if (!handler) {
    const response = apiError(405, "method_not_allowed", \`Method \${method} is not allowed on \${pathname}.\`);
    response.headers.set("Allow", Object.keys(match.route.handlers).sort().join(", "));
    return response;
  }
  try {
    return await handler(request, { slot: 1, manifest, params: match.params, method });
  } catch {
    return apiError(500, "internal_error", "The request failed.");
  }
}

export function GET(request: Request, context: RouteContext) { return dispatch("GET", request, context); }
export function POST(request: Request, context: RouteContext) { return dispatch("POST", request, context); }
export function PUT(request: Request, context: RouteContext) { return dispatch("PUT", request, context); }
export function PATCH(request: Request, context: RouteContext) { return dispatch("PATCH", request, context); }
export function DELETE(request: Request, context: RouteContext) { return dispatch("DELETE", request, context); }
`;

function standaloneLayout(manifest: SlotManifest): string {
  return `import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(manifest.name)},
  description: ${JSON.stringify(manifest.description)},
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
`;
}

const STANDALONE_GLOBALS = `@import "tailwindcss";
`;

const STANDALONE_NOT_FOUND = `import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-60">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found</h1>
        <Link href="/" className="mt-6 inline-block underline underline-offset-4">
          Back to the homepage
        </Link>
      </section>
    </main>
  );
}
`;

const STANDALONE_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  },
  null,
  2,
)}\n`;

const STANDALONE_POSTCSS = `const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
`;

const STANDALONE_NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;

const STANDALONE_DRIZZLE_CONFIG = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/site/db/schema.ts",
  out: "./src/site/db/migrations",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
`;

const STANDALONE_GITIGNORE = `node_modules/
.next/
.env
*.tsbuildinfo
next-env.d.ts
`;

const STANDALONE_ENV_EXAMPLE = `# This standalone app talks to the "public" schema of this database.
DATABASE_URL=postgresql://user:host-needs-configuring/dbname
# Set to "true" for TLS-required providers such as Neon or Supabase.
DATABASE_SSL=false
`;

function standaloneReadme(name: string, manifest: SlotManifest): string {
  return `# ${manifest.name}

Extracted from the Website Slots platform (originally served at \`/s/${manifest.slotId}\`).

${manifest.description}

## Run it

\`\`\`bash
npm install
cp .env.example .env   # then set DATABASE_URL
npm run build
npm start
\`\`\`

## Database

Drizzle tables live in \`src/site/db/schema.ts\`, mapped to the **public**
schema of the standalone database. Apply migrations with:

\`\`\`bash
npm run db:generate   # emit SQL into src/site/db/migrations
npm run db:push       # apply to DATABASE_URL
\`\`\`

To import the data that lived in the monorepo, use the platform's transfer
workflow (\`npm run slots:transfer\`) which produces a schema-mapped,
row-count-verified SQL file safe to load here.

## Structure

- \`src/app/\` — App Router shell (dispatch + API wiring)
- \`src/site/\` — the website itself (pages, components, api handlers, db)
- \`src/lib/\` — shared primitives copied from the platform
`;
}

/** Files the extractor must never copy into a standalone project. */
function isSkippable(relativePath: string): boolean {
  return relativePath === "drizzle.config.ts" || relativePath.endsWith(".gitkeep");
}

export function planExtraction(repoRoot: string, slot: number, name: string, destDir?: string): ExtractPlan {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(name)) {
    throw new Error(
      `Invalid standalone name "${name}" — use lowercase letters, digits, and dashes (3+ chars ok).`,
    );
  }
  const sitesDir = path.join(repoRoot, "sites");
  const { sites } = loadRegisteredSites(sitesDir);
  const entry = sites.find((site) => site.slotId === slot);
  if (!entry) throw new Error(`Slot ${slot} is not registered — nothing to extract.`);
  if (!existsSync(path.join(entry.dir, "site.tsx")) && !existsSync(path.join(entry.dir, "site.ts"))) {
    throw new Error(`Slot ${slot} has no site entry point (site.tsx) — nothing to extract.`);
  }

  const resolvedDest = destDir ?? path.resolve(repoRoot, "..", name);
  const sitesRoot = path.resolve(sitesDir);
  if (path.resolve(resolvedDest).startsWith(sitesRoot + path.sep)) {
    throw new Error("Extraction destination must not live inside sites/. Standalone means outside.");
  }
  if (existsSync(resolvedDest) && readdirSync(resolvedDest).length > 0) {
    throw new Error(`Destination already exists and is not empty: ${resolvedDest}`);
  }
  return { slot, name, destDir: resolvedDest, sourceDir: entry.dir };
}

export function extractSlot(repoRoot: string, plan: ExtractPlan): ExtractReport {
  const { sites } = loadRegisteredSites(path.join(repoRoot, "sites"));
  const entry = sites.find((site) => site.slotId === plan.slot);
  if (!entry) throw new Error(`Slot ${plan.slot} disappeared during extraction.`);

  const monorepoPkg = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  ) as Record<string, Record<string, string>>;

  const schemaName = slotSchemaName(plan.slot);
  const checks: ExtractReport["checks"] = [];
  const destSiteDir = path.join(plan.destDir, "src", "site");
  mkdirSync(destSiteDir, { recursive: true });

  // 1. Copy + transform the website source.
  let filesCopied = 0;
  for (const absoluteSource of listFilesRecursive(entry.dir)) {
    const relative = path.relative(entry.dir, absoluteSource);
    if (isSkippable(relative)) continue;
    const target = path.join(destSiteDir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    const extension = path.extname(absoluteSource);
    if (TEXT_EXTENSIONS.has(extension)) {
      let content = readFileSync(absoluteSource, "utf8");
      if (/\.(tsx?|jsx?|mjs|cjs)$/.test(relative)) {
        content = rewriteSlotUrls(content, plan.slot);
      }
      if (/\.md$/.test(relative)) {
        // Docs: backticked base paths read better as "/" than "".
        content = content
          .replaceAll(`\`/api/s/${plan.slot}\``, "`/api`")
          .replaceAll(`\`/s/${plan.slot}\``, "`/`");
        content = rewriteSlotUrls(content, plan.slot);
        content = content.replaceAll(`sites/${slotDirName(plan.slot)}`, "src/site");
      }
      if (relative === "db/schema.ts") {
        content = rewriteDrizzleSchemaCall(content, schemaName, "public");
      }
      if (/^db[\\/]migrations[\\/].*\.sql$/.test(relative) || relative.endsWith(".sql")) {
        content = rewriteDdlSchema(content, schemaName, "public");
      }
      if (relative === "manifest.json") {
        const manifest = JSON.parse(content) as SlotManifest;
        manifest.database = { mode: "standalone", schema: "public" };
        content = `${JSON.stringify(manifest, null, 2)}\n`;
      }
      writeFileSync(target, content, "utf8");
    } else {
      cpSync(absoluteSource, target);
    }
    filesCopied += 1;
  }

  // 2. Copy only the platform libraries the site actually imports (plus the
  // libraries the generated standalone shell itself requires).
  const libsCopied: string[] = [];
  const copiedSources = listFilesRecursive(destSiteDir)
    .filter((file) => /\.(tsx?|mjs|cjs)$/.test(file));
  const referencedLibs = new Set<string>(["routes", "site-contract", "manifest"]);
  for (const file of copiedSources) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/@\/lib\/([\w-]+)/g)) {
      referencedLibs.add(match[1]);
    }
  }
  for (const lib of [...referencedLibs].sort()) {
    const sourcePath = path.join(repoRoot, "src", "lib", `${lib}.ts`);
    if (!existsSync(sourcePath)) {
      throw new Error(`Site imports "@/lib/${lib}" which does not exist in src/lib — cannot extract.`);
    }
    // Transitive scan: copied libs may reference other platform libs.
    const libSource = readFileSync(sourcePath, "utf8");
    for (const match of libSource.matchAll(/(?:from|import)\s+["']\.\/([\w-]+)["']/g)) {
      referencedLibs.add(match[1]);
    }
    const target = path.join(plan.destDir, "src", "lib", `${lib}.ts`);
    mkdirSync(path.dirname(target), { recursive: true });
    atomicWriteFile(target, libSource);
    libsCopied.push(lib);
  }
  // Ensure transitive deps discovered after first pass are copied too.
  for (const lib of referencedLibs) {
    const target = path.join(plan.destDir, "src", "lib", `${lib}.ts`);
    if (!existsSync(target)) {
      const sourcePath = path.join(repoRoot, "src", "lib", `${lib}.ts`);
      if (!existsSync(sourcePath)) {
        throw new Error(`Transitive dependency "@/lib/${lib}" is missing in src/lib — cannot extract.`);
      }
      atomicWriteFile(target, readFileSync(sourcePath, "utf8"));
      libsCopied.push(lib);
    }
  }

  // 3. App shell + standalone configuration.
  const standaloneManifest = { ...entry.manifest, database: { mode: "standalone", schema: "public" } } as SlotManifest;
  const appDir = path.join(plan.destDir, "src", "app");
  mkdirSync(path.join(appDir, "[[...path]]"), { recursive: true });
  mkdirSync(path.join(appDir, "api", "[[...path]]"), { recursive: true });
  const shellFiles: Record<string, string> = {
    [path.join(appDir, "layout.tsx")]: standaloneLayout(standaloneManifest),
    [path.join(appDir, "globals.css")]: STANDALONE_GLOBALS,
    [path.join(appDir, "not-found.tsx")]: STANDALONE_NOT_FOUND,
    [path.join(appDir, "[[...path]]", "page.tsx")]: STANDALONE_DISPATCHER_PAGE,
    [path.join(appDir, "api", "[[...path]]", "route.ts")]: STANDALONE_API_ROUTE,
    [path.join(plan.destDir, "package.json")]: standalonePackageJson(plan.name, monorepoPkg),
    [path.join(plan.destDir, "tsconfig.json")]: STANDALONE_TSCONFIG,
    [path.join(plan.destDir, "postcss.config.mjs")]: STANDALONE_POSTCSS,
    [path.join(plan.destDir, "next.config.ts")]: STANDALONE_NEXT_CONFIG,
    [path.join(plan.destDir, "drizzle.config.ts")]: STANDALONE_DRIZZLE_CONFIG,
    [path.join(plan.destDir, ".gitignore")]: STANDALONE_GITIGNORE,
    [path.join(plan.destDir, ".env.example")]: STANDALONE_ENV_EXAMPLE,
    [path.join(plan.destDir, "README.md")]: standaloneReadme(plan.name, standaloneManifest),
  };
  for (const [file, content] of Object.entries(shellFiles)) {
    atomicWriteFile(file, content);
  }

  // 4. Verification — no leftover platform coupling.
  const leftovers: string[] = [];
  const platformImports: string[] = [];
  for (const file of listFilesRecursive(destSiteDir).filter((f) => /\.(tsx?|css|md|json)$/.test(f))) {
    const source = readFileSync(file, "utf8");
    const apiLeft = new RegExp(`/api/s/${plan.slot}${BOUNDARY}`).test(source);
    const siteLeft = new RegExp(`/s/${plan.slot}${BOUNDARY}`).test(source);
    if (apiLeft || siteLeft) leftovers.push(path.relative(plan.destDir, file));
    if (/@\/(generated|db)\b/.test(source) || /sites\/slot-/.test(source)) {
      platformImports.push(path.relative(plan.destDir, file));
    }
  }
  checks.push({
    name: "no-monorepo-urls-left",
    passed: leftovers.length === 0,
    detail: leftovers.length ? `Leftover /s/${plan.slot} URLs in: ${leftovers.join(", ")}` : undefined,
  });
  checks.push({
    name: "no-platform-registry-imports",
    passed: platformImports.length === 0,
    detail: platformImports.length ? `Imports of @/generated, @/db, or other slots in: ${platformImports.join(", ")}` : undefined,
  });
  checks.push({
    name: "libs-copied",
    passed: referencedLibs.size === libsCopied.length,
    detail: `copied: ${[...new Set(libsCopied)].sort().join(", ") || "none"}`,
  });

  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    throw new Error(
      `Extraction verification failed: ${failed.map((check) => `${check.name} (${check.detail})`).join("; ")}`,
    );
  }

  // 5. Mark the source slot as extracted (history preserved).
  const updatedManifest: SlotManifest = {
    ...entry.manifest,
    status: "extracted",
    updatedAt: new Date().toISOString(),
    extraction: { destination: plan.destDir, extractedAt: new Date().toISOString() },
  };
  writeManifest(entry.dir, updatedManifest);

  return {
    filesCopied,
    libsCopied: [...new Set(libsCopied)].sort(),
    checks,
    manifestMarked: true,
    destDir: plan.destDir,
  };
}
