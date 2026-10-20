import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

/** Shared header + footer frame for every Meridian Studio page. */

const NAV = [
  { href: "/work", label: "Work" },
  { href: "/about", label: "Studio" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteChrome({
  basePath,
  active,
  children,
}: {
  basePath: string;
  active?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#1b1813]">
      <header className="border-b border-[#1b1813]/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a
            href={basePath || "/"}
            className="font-serif text-2xl tracking-tight text-[#1b1813] no-underline"
          >
            Meridian<span className="text-[#b34724]">.</span>
          </a>
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            {NAV.map((item) => {
              const isActive = active === item.label.toLowerCase();
              return (
                <a
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-colors sm:px-4 ${
                    isActive
                      ? "bg-[#1b1813] text-[#f4f1ea]"
                      : "text-[#1b1813]/70 hover:text-[#1b1813]"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[#1b1813]/15">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
          <div>
            <p className="font-serif text-2xl">Meridian.</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[#1b1813]/60">
              An architecture and interiors studio working with light, mass,
              and quiet materials.
            </p>
          </div>
          <div className="text-sm leading-7 text-[#1b1813]/70">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1b1813]/50">
              Visit
            </p>
            <p className="mt-2 flex items-start gap-2">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#b34724]" aria-hidden />
              <span>
                Købmagergade 14, 3rd
                <br />
                1150 Copenhagen K
              </span>
            </p>
          </div>
          <div className="text-sm leading-7 text-[#1b1813]/70">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1b1813]/50">
              New business
            </p>
            <a
              href={`${basePath}/contact`}
              className="mt-2 inline-block border-b-2 border-[#b34724] text-[#1b1813] transition-colors hover:text-[#b34724]"
            >
              Start a project
            </a>
          </div>
        </div>
        <div className="border-t border-[#1b1813]/10">
          <p className="mx-auto max-w-6xl px-6 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/40">
            Meridian Studio — served from slot 1 of the platform
          </p>
        </div>
      </footer>
    </div>
  );
}
