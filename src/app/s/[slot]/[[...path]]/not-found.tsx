import Link from "next/link";

/**
 * Rendered (with a real 404 status) when a slot id is not registered or a
 * path is not part of the website's route table.
 */
export default function SlotNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 py-16 text-stone-200">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300/80">
          404 — nothing here
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-white">
          This page does not exist
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          The slot may be unregistered, or the website that lives here does
          not publish this path.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-full bg-amber-400 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-950 transition-colors hover:bg-amber-300"
          >
            Control deck
          </Link>
        </div>
      </section>
    </main>
  );
}
