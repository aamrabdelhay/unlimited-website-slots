"use client";

import { useEffect, useRef, useState } from "react";
import { formatSlotId } from "@/lib/slot-ids";

/**
 * Live website thumbnail: renders the actual site (same-origin /s/N page)
 * inside a sandboxed, non-interactive iframe scaled to 25%. This is a real
 * preview of the running website — not a fake image — and it lazily mounts
 * only near the viewport so large registries stay fast.
 */
export function SiteThumbnail({
  slotId,
  basePath,
  name,
  extracted,
}: {
  slotId: number;
  basePath: string;
  name: string;
  extracted: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Browsers without IntersectionObserver start active (no lazy loading).
  const [active, setActive] = useState(
    () => typeof window !== "undefined" && !("IntersectionObserver" in window),
  );

  useEffect(() => {
    const node = hostRef.current;
    if (!node || active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={hostRef}
      className="relative aspect-[16/10] overflow-hidden bg-[#111114]"
    >
      {/* Watermark fallback behind the live preview (also the loading state). */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="font-mono text-4xl font-semibold tracking-tight text-white/10">
          {formatSlotId(slotId)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/15">
          live preview loading
        </span>
      </div>

      {active && (
        <iframe
          src={basePath}
          title={`${name} — live preview`}
          loading="lazy"
          sandbox=""
          tabIndex={-1}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25] border-0 bg-white transition-transform duration-500 group-hover:scale-[0.26]"
        />
      )}

      {/* Slot number chip — the ordering identity of the website. */}
      <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs font-semibold tracking-tight text-amber-300 backdrop-blur-sm">
        {formatSlotId(slotId)}
      </span>

      {extracted && (
        <span className="absolute right-3 top-3 rounded-md border border-violet-400/40 bg-violet-500/20 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200 backdrop-blur-sm">
          standalone
        </span>
      )}
    </div>
  );
}
