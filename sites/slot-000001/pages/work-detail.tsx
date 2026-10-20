import { notFound } from "next/navigation";
import type { SitePageProps } from "@/lib/site-contract";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteChrome } from "../components/chrome";
import { findProject, nextProject } from "../lib/projects";

/** /work/[slug] — dynamic route parameter demonstration. */
export function WorkDetailPage({ basePath, params }: SitePageProps) {
  const project = findProject(params.slug ?? "");
  if (!project) notFound();
  const next = nextProject(project.slug);

  return (
    <SiteChrome basePath={basePath} active="work">
      <article>
        {/* Masthead */}
        <header
          className="meridian-rise"
          style={{ backgroundColor: project.tone, color: project.toneText }}
        >
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <a
              href={`${basePath}/work`}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] opacity-80 transition-opacity hover:opacity-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              All work
            </a>
            <h1 className="mt-6 font-serif text-5xl tracking-tight sm:text-7xl">
              {project.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 opacity-90">{project.summary}</p>
          </div>
        </header>

        {/* Facts */}
        <div className="border-b border-[#1b1813]/15">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
            {[
              ["Location", project.location],
              ["Year", project.year],
              ["Typology", project.typology],
              ["Area", project.area],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
                  {label}
                </dt>
                <dd className="mt-1 font-serif text-lg">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Body */}
        <div className="mx-auto max-w-3xl px-6 py-16">
          {project.description.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mb-6 text-lg leading-9 text-[#1b1813]/80">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Next project */}
        <div className="border-t border-[#1b1813]/15">
          <a
            href={`${basePath}/work/${next.slug}`}
            className="group mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-10"
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
                Next project
              </p>
              <p className="mt-1 font-serif text-2xl tracking-tight transition-colors group-hover:text-[#b34724]">
                {next.title}
              </p>
            </div>
            <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden />
          </a>
        </div>
      </article>
    </SiteChrome>
  );
}
