# Reserved Slot 127 — slot #000127

Empty placeholder proving sparse slot ids route correctly.

- **Public URL (monorepo):** `/s/127`
- **API base (monorepo):** `/api/s/127`
- **Source:** `sites/slot-000127/`
- **Database:** shared mode, schema `slot_000127` (owned exclusively by this slot)

## Build a website here

Ask the development agent, e.g.:

> "In slot 127, build a complete <kind of> website with <features>."

Or edit manually:

1. Add pages in `pages/` and register them in `site.tsx` (patterns like
   `/`, `/about`, `/work/[slug]`, `/docs/[...rest]`).
2. Add API handlers under `api/` (plain `Request`/`Response`) and register
   them in `site.tsx`.
3. Define tables in `db/schema.ts` — always inside `slotSchema`.
4. Run `npm run registry:generate` and `npm run build`.

## Database

```bash
npm run slot:db -- --slot 127 --cmd generate   # emit SQL from db/schema.ts
npm run slot:db -- --slot 127 --cmd push       # apply to DATABASE_URL
```

Dedicated database: set `SLOT_000127_DATABASE_URL`
(or switch `database.mode` in `manifest.json` to `"dedicated"`).

## Safety

- Never import from another slot's directory.
- Reset safely: `npm run slots:reset -- --slot 127 --dry-run`
- Extract: `npm run slots:extract -- --slot 127 --name my-site`
