import type { SitePageProps } from "@/lib/site-contract";
import { SiteChrome } from "../components/chrome";
import { PROJECTS } from "../lib/projects";

export function WorkPage({ basePath }: SitePageProps) {
  return (
    <SiteChrome basePath={basePath} active="work">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#b34724]">
          2019 — 2025
        </p>
        <h1 className="mt-4 font-serif text-5xl tracking-tight sm:text-6xl">Work</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-[#1b1813]/70">
          A selection of completed buildings. Each one is a negotiation
          between light, weight, and the people who use it.
        </p>

        <ul className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2">
          {PROJECTS.map((project, index) => (
            <li key={project.slug}>
              <a href={`${basePath}/work/${project.slug}`} className="group block">
                <div
                  className="flex aspect-[16/11] items-end justify-between p-7 transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ backgroundColor: project.tone, color: project.toneText }}
                >
                  <span className="font-serif text-6xl tracking-tight">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-80">
                    {project.typology}
                  </span>
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <p className="font-serif text-2xl tracking-tight group-hover:text-[#b34724]">
                    {project.title}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-[#1b1813]/50">
                    {project.year}
                  </p>
                </div>
                <p className="mt-1 text-sm uppercase tracking-[0.1em] text-[#1b1813]/50">
                  {project.location}
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-[#1b1813]/70">
                  {project.summary}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </SiteChrome>
  );
}
