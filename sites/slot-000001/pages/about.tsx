import type { SitePageProps } from "@/lib/site-contract";
import { SiteChrome } from "../components/chrome";

const TEAM = [
  { name: "Ingrid Voss", role: "Founding partner, architect maa" },
  { name: "Tomas Ferreira", role: "Partner, interiors" },
  { name: "Maja Lind", role: "Associate, climate design" },
  { name: "Ruben Castillo", role: "Associate, structures" },
  { name: "Sofia Kjær", role: "Studio manager" },
] as const;

export function AboutPage({ basePath }: SitePageProps) {
  return (
    <SiteChrome basePath={basePath} active="studio">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#b34724]">
          The studio
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          A small studio for buildings that stay out of the way.
        </h1>
      </section>

      <section className="border-t border-[#1b1813]/15">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div className="space-y-6 text-lg leading-9 text-[#1b1813]/80">
            <p>
              Meridian was founded in Copenhagen in 2016 around a simple
              conviction: architecture improves as it is reduced. We work on
              a deliberately small number of projects at a time, from first
              site visit to the last coat of limewash.
            </p>
            <p>
              The studio spans architecture and interiors, so a building and
              its rooms are designed as one thought. Our work has been
              published internationally and recognised with the Nykredit
              Architecture Grant (2024) and a Dezeen Award for housing (2023).
            </p>
          </div>
          <div className="border-l-0 border-[#1b1813]/15 sm:border-l sm:pl-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
              Numbers
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-8">
              {[
                ["18", "built works"],
                ["6", "countries"],
                ["23", "awards & nominations"],
                ["9", "people, one dog"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="order-2 mt-1 text-sm text-[#1b1813]/60">{label}</dt>
                  <dd className="font-serif text-4xl tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1b1813]/15">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-serif text-3xl tracking-tight">People</h2>
          <ul className="mt-8 divide-y divide-[#1b1813]/10 border-y border-[#1b1813]/10">
            {TEAM.map((person) => (
              <li
                key={person.name}
                className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <p className="font-serif text-xl tracking-tight">{person.name}</p>
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-[#1b1813]/50">
                  {person.role}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteChrome>
  );
}
