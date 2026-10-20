import type { SitePageProps } from "@/lib/site-contract";
import { ArrowRight } from "lucide-react";
import { SiteChrome } from "../components/chrome";
import { PROJECTS } from "../lib/projects";

export function HomePage({ basePath }: SitePageProps) {
  const featured = PROJECTS.slice(0, 3);
  return (
    <SiteChrome basePath={basePath} active="home">
      {/* Hero */}
      <section className="border-b border-[#1b1813]/15">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
          <p className="meridian-rise font-mono text-xs uppercase tracking-[0.3em] text-[#b34724]">
            Architecture · Interiors · Copenhagen
          </p>
          <h1
            className="meridian-rise mt-6 font-serif text-[clamp(3rem,9vw,6.5rem)] leading-[0.98] tracking-tight"
            style={{ animationDelay: "80ms" }}
          >
            Space,
            <br />
            made quiet.
          </h1>
          <p
            className="meridian-rise mt-8 max-w-xl text-lg leading-8 text-[#1b1813]/70"
            style={{ animationDelay: "160ms" }}
          >
            Meridian is an architecture studio designing buildings of few
            moves and lasting materials — houses, galleries, schools, and
            bathhouses across Scandinavia and beyond.
          </p>
          <div className="meridian-rise mt-10" style={{ animationDelay: "240ms" }}>
            <a
              href={`${basePath}/work`}
              className="group inline-flex items-center gap-3 border-b-2 border-[#1b1813] pb-1 text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:border-[#b34724] hover:text-[#b34724]"
            >
              See selected work
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* Selected work */}
      <section className="border-b border-[#1b1813]/15">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-end justify-between gap-6">
            <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">Selected work</h2>
            <a
              href={`${basePath}/work`}
              className="hidden text-xs font-medium uppercase tracking-[0.2em] text-[#1b1813]/60 transition-colors hover:text-[#b34724] sm:block"
            >
              All projects
            </a>
          </div>
          <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-3">
            {featured.map((project, index) => (
              <li key={project.slug}>
                <a href={`${basePath}/work/${project.slug}`} className="group block">
                  <div
                    className="flex aspect-[4/5] items-end p-6 transition-transform duration-300 group-hover:-translate-y-1"
                    style={{ backgroundColor: project.tone, color: project.toneText }}
                  >
                    <span className="font-serif text-5xl tracking-tight">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <p className="font-serif text-xl tracking-tight group-hover:text-[#b34724]">
                      {project.title}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#1b1813]/50">
                      {project.year}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-[#1b1813]/60">{project.location}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Practice */}
      <section className="border-b border-[#1b1813]/15">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">The practice</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Few moves",
                body: "Each project is reduced until only the essential gestures remain — then those are done properly.",
              },
              {
                n: "02",
                title: "Honest mass",
                body: "Adobe, stone, timber, and lime. Materials that age with dignity and can be repaired by hand.",
              },
              {
                n: "03",
                title: "Climate first",
                body: "Section, orientation, and thermal mass before machinery. Comfort designed in, not bolted on.",
              },
            ].map((item) => (
              <div key={item.n} className="border-t-2 border-[#1b1813] pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b34724]">{item.n}</p>
                <p className="mt-2 font-serif text-lg">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#1b1813]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#1b1813]/50">
            Currently booking 2027
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-serif text-3xl leading-snug tracking-tight sm:text-4xl">
            Have a site, a building, or a quarry we should see?
          </p>
          <a
            href={`${basePath}/contact`}
            className="mt-8 inline-flex items-center gap-3 bg-[#1b1813] px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#f4f1ea] transition-colors hover:bg-[#b34724]"
          >
            Start a conversation
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </section>
    </SiteChrome>
  );
}
