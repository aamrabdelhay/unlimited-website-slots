# Meridian Studio — slot #000001

Architecture & interior design studio — multi-page site with dynamic routes, a working contact form, and a slot-scoped database.

- **Public URL (monorepo):** `/s/1`
- **API base (monorepo):** `/api/s/1`
- **Source:** `sites/slot-000001/`
- **Database:** shared mode, schema `slot_000001` (owned exclusively by this slot)

## Build a website here

Ask the development agent, e.g.:

> "In slot 1, build a complete <kind of> website with <features>."

Or edit manually:

1. Add pages in `pages/` and register them in `site.tsx` (patterns like
   `/`, `/about`, `/work/[slug]`, `/docs/[...rest]`).
2. Add API handlers under `api/` (plain `Request`/`Response`) and register
   them in `site.tsx`.
3. Define tables in `db/schema.ts` — always inside `slotSchema`.
4. Run `npm run registry:generate` and `npm run build`.

## Database

```bash
npm run slot:db -- --slot 1 --cmd generate   # emit SQL from db/schema.ts
npm run slot:db -- --slot 1 --cmd push       # apply to DATABASE_URL
```

Dedicated database: set `SLOT_000001_DATABASE_URL`
(or switch `database.mode` in `manifest.json` to `"dedicated"`).

## Safety

- Never import from another slot's directory.
- Reset safely: `npm run slots:reset -- --slot 1 --dry-run`
- Extract: `npm run slots:extract -- --slot 1 --name my-site`
