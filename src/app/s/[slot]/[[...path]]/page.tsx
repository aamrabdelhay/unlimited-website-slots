import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSlotEntry, type SlotRegistryEntry } from "@/generated/slot-registry";
import { parseSlotParam } from "@/lib/slot-ids";
import { matchRoute, normalizePath } from "@/lib/routes";

/**
 * Central website dispatcher.
 *
 * Every public site URL — /s/N, /s/N/about, /s/N/work/some-slug — lands
 * here. The slot id is validated, resolved against the generated static
 * registry, and the site contract decides which component renders. Slots
 * that are not registered receive a proper 404.
 */

export const dynamic = "force-dynamic";

type RouteParams = { slot: string; path?: string[] };

interface Resolved {
  slotId: number;
  entry: SlotRegistryEntry;
  pathname: string;
}

async function resolveSlot(params: Promise<RouteParams>): Promise<Resolved | null> {
  const { slot, path } = await params;
  const slotId = parseSlotParam(slot);
  if (slotId === null) return null;
  const entry = getSlotEntry(slotId);
  if (!entry) return null;
  const pathname = normalizePath(`/${(path ?? []).join("/")}`);
  return { slotId, entry, pathname };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const resolved = await resolveSlot(params);
  if (!resolved) return { title: "Unknown website" };

  const fallback: Metadata = {
    title: resolved.entry.manifest.name,
    description: resolved.entry.manifest.description || undefined,
  };
  const match = matchRoute(resolved.entry.site.routes, resolved.pathname);
  if (!match || !match.route.metadata) return fallback;

  const provided =
    typeof match.route.metadata === "function"
      ? await match.route.metadata({
          slot: resolved.slotId,
          manifest: resolved.entry.manifest,
          params: match.params,
          basePath: resolved.entry.basePath,
        })
      : match.route.metadata;
  return { ...fallback, ...provided };
}

export default async function SlotSitePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await resolveSlot(params);
  if (!resolved) notFound();

  const match = matchRoute(resolved.entry.site.routes, resolved.pathname);
  if (!match) notFound();

  const Component = match.route.component;
  const styles = resolved.entry.site.styles;

  return (
    <>
      {styles ? <style dangerouslySetInnerHTML={{ __html: styles }} /> : null}
      <Component
        slot={resolved.slotId}
        manifest={resolved.entry.manifest}
        params={match.params}
        searchParams={await searchParams}
        basePath={resolved.entry.basePath}
      />
    </>
  );
}
