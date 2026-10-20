import type { SitePageProps } from "@/lib/site-contract";
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
            <dd className="text-neutral-300">{manifest.database.schema ?? `slot_${String(slot).padStart(6, "0")}`}</dd>
          </div>
        </dl>
        <p className="mt-8 font-mono text-xs text-neutral-600">
          npm run slots:reset -- --slot 5 --dry-run
        </p>
      </section>
    </main>
  );
}
