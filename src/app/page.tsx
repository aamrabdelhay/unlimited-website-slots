import { Gamepad2, Scale } from "lucide-react";

export default function DashboardPage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 py-12 text-stone-100"
    >
      <nav
        aria-label="المواقع"
        className="grid w-full max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <a
          href="/marafeat-tanfiz.html"
          className="group flex min-h-64 flex-col items-center justify-center gap-7 rounded-3xl border border-amber-200/20 bg-gradient-to-br from-[#18263a] to-[#101820] px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-amber-200/50 hover:shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-200/25 bg-amber-200/10 text-amber-200 transition duration-300 group-hover:scale-105 group-hover:bg-amber-200/15">
            <Scale className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-wide text-stone-50 sm:text-2xl">
            مرافعات تنفيذ جبري
          </span>
        </a>

        <a
          href="/snake-evolution.html"
          className="group relative flex min-h-64 flex-col items-center justify-center gap-7 overflow-hidden rounded-3xl border border-emerald-200/20 bg-gradient-to-br from-[#173b36] via-[#102b2c] to-[#101820] px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200/50 hover:shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-200"
        >
          <span className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl transition group-hover:bg-emerald-300/20" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200/25 bg-emerald-200/10 text-emerald-200 transition duration-300 group-hover:scale-105">
            <Gamepad2 className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className="relative text-xl font-bold tracking-wide text-stone-50 sm:text-2xl">
            لعبة Snake Evolution
          </span>
          <span className="relative text-xs text-emerald-100/65">
            OLD IS GOLD · OPEN MAP
          </span>
        </a>
      </nav>
    </main>
  );
}
