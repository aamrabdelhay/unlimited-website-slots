"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CircleSlash,
  FolderOpen,
  Search,
  Terminal,
} from "lucide-react";
import type { RegistryIndexEntry, SlotStatus } from "@/lib/manifest";
import { formatSlotId } from "@/lib/slot-ids";
import { CopyChip } from "./copy-chip";
import { SiteThumbnail } from "./site-thumbnail";

const PAGE_SIZE = 24;

const STATUS_META: Record<
  SlotStatus,
  { label: string; dot: string; pill: string }
> = {
  "in-use": {
    label: "In use",
    dot: "bg-emerald-400",
    pill: "border-emerald-400/30 text-emerald-300",
  },
  empty: {
    label: "Empty",
    dot: "bg-stone-500",
    pill: "border-white/15 text-stone-400",
  },
  extracted: {
    label: "Extracted",
    dot: "bg-violet-400",
    pill: "border-violet-400/30 text-violet-300",
  },
};

const FILTERS: { value: SlotStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-use", label: "In use" },
  { value: "empty", label: "Empty" },
  { value: "extracted", label: "Extracted" },
];

export function DeckBrowser({ slots }: { slots: RegistryIndexEntry[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SlotStatus | "all">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slots.filter((slot) => {
      if (status !== "all" && slot.status !== status) return false;
      if (!q) return true;
      const padded = formatSlotId(slot.slotId).toLowerCase();
      return (
        String(slot.slotId).includes(q) ||
        padded.includes(q) ||
        slot.name.toLowerCase().includes(q) ||
        slot.description.toLowerCase().includes(q) ||
        slot.dirName.toLowerCase().includes(q)
      );
    });
  }, [slots, query, status]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  function onFilterChange(next: SlotStatus | "all"): void {
    setStatus(next);
    setVisible(PAGE_SIZE);
  }

  if (slots.length === 0) {
    return <EmptyDeck />;
  }

  return (
    <section aria-label="Registered websites">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search by name, id, or description…"
            aria-label="Search websites"
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-stone-200 placeholder:text-stone-600 outline-none transition-colors focus:border-amber-300/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => onFilterChange(filter.value)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                    : "border-white/10 text-stone-400 hover:border-white/25 hover:text-stone-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        {filtered.length} of {slots.length} website{slots.length === 1 ? "" : "s"}
      </p>

      {/* Grid */}
      {shown.length > 0 ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((slot) => (
            <SlotCard key={slot.slotId} slot={slot} />
          ))}
        </ul>
      ) : (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <CircleSlash className="h-6 w-6 text-stone-600" aria-hidden />
          <p className="mt-4 text-sm text-stone-400">
            No websites match “{query}”
            {status !== "all" ? ` with status “${STATUS_META[status].label}”` : ""}.
          </p>
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="rounded-full border border-white/15 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-300 transition-colors hover:border-amber-300/50 hover:text-amber-200"
          >
            Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
          </button>
        </div>
      )}
    </section>
  );
}

function SlotCard({ slot }: { slot: RegistryIndexEntry }) {
  const meta = STATUS_META[slot.status];
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-amber-300/30 hover:bg-white/[0.05]">
      {/* Live thumbnail of the actual website, numbered by slot order. */}
      <a
        href={slot.basePath}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${slot.name} (slot ${slot.slotId})`}
        className="block border-b border-white/10"
      >
        <SiteThumbnail
          slotId={slot.slotId}
          basePath={slot.basePath}
          name={slot.name}
          extracted={slot.status === "extracted"}
        />
      </a>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-stone-500">
            site {formatSlotId(slot.slotId)}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
            {meta.label}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-semibold tracking-tight text-stone-100">
          {slot.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-stone-400">
          {slot.description || "No description yet."}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
          <span className="font-mono text-[11px] text-stone-600">
            updated {slot.updatedAt.slice(0, 10)}
          </span>
          <a
            href={slot.basePath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400 hover:text-stone-950"
          >
            Open site
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </li>
  );
}

function EmptyDeck() {
  return (
    <section
      aria-label="No websites yet"
      className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 px-6 py-20 text-center"
    >
      <FolderOpen className="h-8 w-8 text-stone-600" aria-hidden />
      <h2 className="mt-5 text-xl font-semibold text-stone-100">No websites registered yet</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-stone-400">
        Create your first slot from an authorized development environment.
        Slots are numbered with any positive integer — 1 today, 127 tomorrow.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <CopyChip command="npm run slots:create" />
        <CopyChip command="npm run slots:create -- --slot 127 --name &quot;My Site&quot;" label="npm run slots:create -- --slot 127" />
      </div>
      <p className="mt-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
        <Terminal className="h-3.5 w-3.5" aria-hidden />
        then rebuild: npm run build
      </p>
    </section>
  );
}
