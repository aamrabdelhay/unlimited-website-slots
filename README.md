# Unlimited Website Slots

One Next.js application that hosts an **unlimited number of independent
websites**, each in its own numbered slot — plus a workflow to extract any of
them into a standalone Next.js project with its own database.

- **No slot ceiling.** Slot ids are any positive integer: 1, 3, 127, 10 000.
  Sparse ids work out of the box (slot 127 works while 2–126 don't exist).
- **No passwords anywhere.** Not the dashboard, not the sites, not the CLI.
  Dangerous operations live in authorized development environments and are
  guarded by explicit typed confirmations — never password prompts.
- **Real isolation.** Every slot owns its source, routes, API handlers,
  branding, and a dedicated PostgreSQL schema (`slot_000127` etc.).

```text
/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # control deck (dashboard)
│   │   ├── s/[slot]/[[...path]]/page.tsx  # website dispatcher
│   │   └── api/s/[slot]/[[...path]]/route.ts
│   ├── generated/                         # GENERATED registry (committed)
│   └── lib/                               # slot-ids, routes, manifest, db-config, …
├── sites/
│   ├── slot-000001/   Meridian Studio — full demo website (DB-backed)
│   └── slot-000127/   empty placeholder proving sparse ids
├── scripts/           create/reset/extract/list/transfer tooling
├── tests/             Vitest suite (51 checks)
└── registry.json      human/machine index of everything registered
```

## How it works

Next.js cannot compile arbitrary directories at runtime, so the platform uses
a **generated static registry**. `scripts/generate-registry.ts` discovers
every valid `sites/slot-*/` directory, validates each `manifest.json` with
Zod, and emits `src/generated/slot-registry.ts` containing explicit static
imports plus a verified route table. It runs automatically before
`npm run dev` and `npm run build` — adding a site = regenerate + rebuild +
redeploy, by design.

Routing:

| URL | Handler |
| --- | --- |
| `/` | Control deck: live numbered thumbnails of every website, search, status filters, incremental loading |
| `/s/N`, `/s/N/about`, `/s/N/work/x` | Slot dispatcher → the site's own route table (`/`, `/about`, `/work/[slug]`, `/docs/[...rest]`) |
| `/api/s/N/...` | Slot API dispatcher → the site's web-standard `Request`/`Response` handlers |

Unregistered slots and unknown site paths return real 404s.

## Quick start

```bash
cp .env.example .env        # set DATABASE_URL (only needed for DB features)
npm install
npm run build               # regenerates the registry, then builds
npm start
```

Open `/` for the deck, `/s/1` for the demo website, `/s/127` for an empty slot.

## Creating slots (on demand, unlimited)

```bash
npm run slots:create                                   # next free id
npm run slots:create -- --slot 127                     # specific sparse id
npm run slots:create -- --slot 3 --name "Law Firm" --status in-use \
    --description "Corporate law firm website"
```

The script scaffolds `sites/slot-000003/` (manifest, `site.tsx`, starter page,
`db/schema.ts`, per-slot `drizzle.config.ts`, README), refuses to overwrite an
occupied slot, regenerates the registry, and verifies the new slot appears in
the generated route table.

## Building a website in a slot

Ask the development agent:

> "In slot 3, build a complete law firm website with appointment booking."

Or by hand: everything lives inside the slot directory.

- **Pages** — `pages/*.tsx`, registered in `site.tsx` with patterns like
  `/`, `/about`, `/work/[slug]`, `/docs/[...rest]`. Components receive
  `{ slot, manifest, params, searchParams, basePath }`; build internal links
  with `${basePath}/about` so extraction rewrites them correctly.
- **API handlers** — `api/*.ts`, plain web `Request → Response`, registered
  in the same `site.tsx`. Validate input with Zod, rate-limit public writes
  with `createRateLimiter` (see `sites/slot-000001/api/messages.ts`).
- **Styles** — Tailwind classes everywhere; `styles.ts` for keyframes and
  custom properties (injected as a scoped `<style>` when the slot renders).
- **Database** — tables in `db/schema.ts`, always inside your slot's
  `pgSchema(...)`; access through the slot-local `lib/db.ts`.

Rules: never import from another slot, never import `@/generated/*` or `@/db`
inside a site (enforced by tests), and scope every database table to the
slot's own schema.

## Listing, resetting, extracting

```bash
npm run slots:list                 # table of registered sites
npm run slots:list -- --json       # machine-readable

npm run slots:reset -- --slot 3 --dry-run            # preview the plan
npm run slots:reset -- --slot 3 --confirm 3          # reset source code
npm run slots:reset -- --slot 3 --confirm 3 --db     # + drop the DB schema
npm run slots:reset -- --slot 3 --confirm 3 --repurpose   # reuse an extracted slot

npm run slots:extract -- --slot 3 --name client-portal [--dest ../path] \
    [--dry-run] [--verify-install]
```

Reset makes a timestamped backup under `.backups/` first, separates source
reset from database deletion, validates the target schema before any DDL, and
requires `--allow-production` to touch a database when `NODE_ENV=production`.
Slot ids are never renumbered; extraction history is preserved in the manifest.

## Extraction

`npm run slots:extract -- --slot 1 --name meridian --dest /tmp/meridian`
produces a standalone Next.js app containing only what the site needs:

- `src/site/` — the whole slot, with `/s/1/...` URLs rewritten to root and
  `/api/s/1/...` rewritten to `/api/...`
- `src/app/` — App Router shell (dispatch, API wiring, 404)
- `src/lib/` — **only** the platform primitives the site imports (verified)
- Standalone `package.json`, `tsconfig`, Tailwind/PostCSS config,
  `.env.example`, Drizzle config targeting the `public` schema, README
- Manifest rewritten to `database.mode = "standalone"`

Static verification runs before the source manifest is marked `extracted`
(no leftover `/s/N` URLs, no `@/generated` or cross-slot imports). Pass
`--verify-install` to additionally run `npm install`, `tsc --noEmit`, and
`next build` inside the extracted project.

### Moving the data

```bash
npm run slots:transfer -- export --slot 1 --out backups/slot-000001.sql
npm run slots:transfer -- transform --in backups/slot-000001.sql \
    --out backups/standalone.sql --from-schema slot_000001 --to-schema public
npm run slots:transfer -- import --file backups/standalone.sql \
    --target-env SLOT_000001_DATABASE_URL --confirm
```

`export` uses `pg_dump --data-only --inserts` scoped to the slot's schema.
`transform` rewrites **statement heads only** (INSERT INTO / COPY table
references, `setval` sequence names, `SET search_path`) — never global text
replacement, so row data mentioning the schema name stays byte-identical
(this is unit-tested). `import` loads via `psql` and prints per-table row
counts for verification. Connection strings come from env vars and are
redacted from logs; existing targets are never overwritten without `--force`
/ `--confirm`.

## Database architecture

- **Shared mode (default):** `DATABASE_URL`, one schema per slot, derived
  from the slot id: `slot_000001`, `slot_000127`, … The derivation happens
  server-side from validated data — a request can never smuggle in a schema.
- **Dedicated mode:** set `SLOT_000003_DATABASE_URL` and/or
  `database.mode: "dedicated"` in the manifest for a separate PostgreSQL
  database (Neon project, Supabase project, …).
- **Standalone mode:** written by extraction; `DATABASE_URL`, `public` schema.

Precedence: `SLOT_XXXXXX_DATABASE_URL` → `DATABASE_URL`. Set
`DATABASE_SSL=true` for TLS-required providers. No database is required to
render the dashboard or an empty slot, and migrations never run during page
requests or startup.

Per-slot migrations:

```bash
npm run slot:db -- --slot 1 --cmd generate   # emit SQL into the slot's db/migrations
npm run slot:db -- --slot 1 --cmd push       # apply (schemaFilter limits to the slot's schema)
```

> **Isolation honesty:** separate schemas share one database role in shared
> mode, so a compromised slot could theoretically reach sibling schemas via
> raw SQL. The platform prevents cross-slot access through all application
> paths (typed APIs, derived schemas, tested), but for hard security
> isolation use dedicated databases or restricted roles — no website login
> passwords are needed for that.

## Tests & verification

```bash
npm run test        # 51 Vitest checks
npm run lint
npm run typecheck
npm run build
```

The suite covers: unlimited/sparse slot ids (3, 127, 10 000), the route
matcher (nested, params, catch-alls, specificity), manifest validation,
registry generation in temp repos, DB config selection and cross-slot
isolation, the pg_dump transform, end-to-end extraction into a temp project,
reset safeguards, password-free operation (static scans), cross-slot import
prevention, and dashboard-without-database behavior. Tests never touch
production data.

## Deployment (Vercel & friends)

- One deployment hosts the deck + all registered slots.
- `npm run build` regenerates the registry first, so a push that adds
  `sites/slot-XXXXXX/` deploys it automatically.
- Set `DATABASE_URL` (and `DATABASE_SSL=true` for Neon/Supabase) in project
  env; add `SLOT_XXXXXX_DATABASE_URL` per dedicated slot.
- File-changing workflows (create/reset/extract) intentionally do **not**
  exist as public endpoints — serverless can't persist repo changes. Run them
  locally or in CI and push the result.

## Scaling notes

There is no application-level maximum. Practical limits are repository size,
build time, and database resources. Mitigations:

- The deck paginates client-side (24/page) — thousands of slots still work.
- Registry generation is deterministic (sorted, atomic writes).
- A site that grows very large, needs custom server config, custom
  `html lang/dir` (e.g. a fully Arabic RTL document), its own middleware, or
  an independent deploy cadence should be **extracted** — that's the designed
  escape hatch, not an afterthought. The codebase supports RTL content
  inside pages (`<div dir="rtl" lang="ar">`) but document-level control is a
  standalone-app feature.
- The in-memory rate limiter is per-instance on serverless; extract and swap
  in a durable store when you need global guarantees.

## Troubleshooting

- **`/s/N` 404s** — slot not in `registry.json`: run `npm run registry:generate`.
- **Build fails on a slot import** — delete/repair the offending
  `sites/slot-*/`; the registry validates manifests and fails fast.
- **`database_unconfigured` API responses** — set `DATABASE_URL` (or the
  slot's dedicated var), apply `db/migrations`, reload.
- **`drizzle-kit` warns about empty url** — it reads `DATABASE_URL` from the
  environment, not from `.env`, when invoked via `npm run slot:db`; export it
  first (`set -a; . ./.env; set +a`).
- **Extraction refuses my destination** — it must be outside `sites/` and
  either not exist or be empty.
