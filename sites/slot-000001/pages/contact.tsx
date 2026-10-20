import type { SitePageProps } from "@/lib/site-contract";
import { Database } from "lucide-react";
import { SiteChrome } from "../components/chrome";
import { ContactForm } from "../components/contact-form";
import { listMessages } from "../lib/messages";

/**
 * Contact page — the form posts to the slot's own API. The recent-messages
 * panel below is server-rendered from this slot's database schema, and says
 * so honestly when no connection is configured.
 */
export async function ContactPage({ basePath }: SitePageProps) {
  const endpoint = `/api${basePath}/messages`;
  const result = await listMessages(5);

  return (
    <SiteChrome basePath={basePath} active="contact">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#b34724]">
          New business
        </p>
        <h1 className="mt-4 font-serif text-5xl tracking-tight sm:text-6xl">Contact</h1>

        <div className="mt-12 grid gap-16 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-8 text-base leading-7 text-[#1b1813]/75">
            <p>
              Tell us about the site and the ambition — two or three sentences
              is plenty. Every message lands directly in the studio inbox and
              is read by a partner.
            </p>
            <dl className="space-y-4">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
                  Email
                </dt>
                <dd className="mt-1 font-serif text-xl">studio@meridian.example</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
                  Phone
                </dt>
                <dd className="mt-1 font-serif text-xl">+45 33 00 00 00</dd>
              </div>
            </dl>
            <p className="text-sm text-[#1b1813]/50">
              No account or login needed — this form is public and protected
              by rate limiting and validation instead of passwords.
            </p>
          </div>

          <div>
            <ContactForm endpoint={endpoint} />
          </div>
        </div>
      </section>

      {/* Database-backed panel — proves slot-scoped reads server-side. */}
      <section className="border-t border-[#1b1813]/15 bg-[#efeae0]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-[#b34724]" aria-hidden />
            <h2 className="font-serif text-2xl tracking-tight">Studio inbox</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1b1813]/50">
              live from schema slot_000001
            </span>
          </div>

          {result.ok ? (
            result.data.length > 0 ? (
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.data.map((row) => (
                  <li
                    key={row.id}
                    className="border border-[#1b1813]/15 bg-[#f4f1ea] p-5"
                  >
                    <p className="text-sm leading-6 text-[#1b1813]/80">“{row.message}”</p>
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-[#1b1813]/50">
                      {row.name} ·{" "}
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                        row.createdAt,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 text-sm text-[#1b1813]/60">
                The inbox is empty — the first message above will appear here.
              </p>
            )
          ) : (
            <div className="mt-8 border border-[#b34724]/40 bg-[#b34724]/5 p-5 text-sm leading-6 text-[#8f3418]">
              <p className="font-medium">
                The message database is not reachable, so this panel cannot
                render live data.
              </p>
              <p className="mt-1">
                Reason: {result.message} Configure <code>DATABASE_URL</code>,
                apply the migrations in this website&apos;s db/migrations
                directory, and reload.
              </p>
            </div>
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
