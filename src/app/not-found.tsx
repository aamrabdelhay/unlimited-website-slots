import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 py-16 text-stone-200">
      <section className="w-full max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300/80">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          This path is outside every registered website and the control deck.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-amber-400 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-950 transition-colors hover:bg-amber-300"
        >
          Back to the deck
        </Link>
      </section>
    </main>
  );
}
