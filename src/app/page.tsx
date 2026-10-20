import { Boxes, Database, FolderGit2, Layers } from "lucide-react";
import registryIndexJson from "@/generated/registry.json";
import { registryIndexSchema } from "@/lib/manifest";
import { DeckBrowser } from "@/components/deck-browser";

/**
 * Central control deck for the whole platform. Public by design — there is
 * no login anywhere in this system. Source-code changes happen through the
 * development agent or CLI, never through unauthenticated HTTP endpoints.
 */

const index = registryIndexSchema.parse(registryIndexJson);

export default function DashboardPage() {
  // Thumbnails are ordered strictly by slot id — the numbering is the order.
  const slots = [...index.slots].sort((a, b) => a.slotId - b.slotId);
  const counts = {
    total: slots.length,
    inUse: slots.filter((s) => s.status === "in-use").length,
    empty: slots.filter((s) => s.status === "empty").length,
    extracted: slots.filter((s) => s.status === "extracted").length,
  };

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-stone-200">
      {/* Top bar */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-5">
          <p className="font-mono text-sm tracking-tight text-white">
            slots<span className="text-amber-300">/</span>
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-14 sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">
            Control deck
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Every website you build, one deck to run them.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-400">
            Each slot owns its pages, API, branding, and database schema.
            Build any number of sites under <code className="font-mono text-stone-300">/s/N</code>,
            then extract any of them into a standalone Next.js project when it
            outgrows the nest.
          </p>

          {/* Stats */}
          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {[
              { label: "Registered", value: counts.total, icon: Layers },
              { label: "In use", value: counts.inUse, icon: Boxes },
              { label: "Empty", value: counts.empty, icon: FolderGit2 },
              { label: "Extracted", value: counts.extracted, icon: Database },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0b0b0d] px-5 py-4">
                <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  <stat.icon className="h-3.5 w-3.5" aria-hidden />
                  {stat.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Deck browser */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <DeckBrowser slots={slots} />
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <span>unlimited website slots</span>
          <span>route table built {index.generatedAt.slice(0, 10)}</span>
        </div>
      </footer>
    </main>
  );
}
