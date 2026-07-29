// components/admin/templates/render-blocks/restaurants-directory.tsx
'use client';

// The apex-portal directory block (restaurant domain-competitions): renders the
// contest cohort as diner-facing restaurant cards, WINNER featured first. Content
// carries a `campaign_id` (drives a live fetch so winner changes show without a
// republish) + an `entries` snapshot (instant paint / fallback when the API is
// unreachable). Same renderer in the editor and on the public site.
import * as React from 'react';
import type { Block } from '@/types/blocks';
import DirectoryCurator from '@/components/sites/directory-curator';

type Entry = {
  template_id: string;
  slug: string;
  business_name: string;
  url: string;
  hero_url?: string | null;
  is_winner?: boolean;
};

function pickContent(block: any, content?: any): any {
  return content ?? block?.content ?? block?.props ?? {};
}

function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort(
    (a, b) => Number(!!b.is_winner) - Number(!!a.is_winner) || a.business_name.localeCompare(b.business_name),
  );
}

function Card({ entry, featured }: { entry: Entry; featured?: boolean }) {
  return (
    <a
      href={entry.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition hover:border-amber-500/50 hover:bg-zinc-900 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <div className={`relative w-full overflow-hidden bg-zinc-800 ${featured ? 'aspect-[2/1]' : 'aspect-[3/2]'}`}>
        {entry.hero_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.hero_url}
            alt={entry.business_name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🍽️</div>
        )}
        {entry.is_winner && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 shadow">
            ★ Featured
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-base font-semibold text-white group-hover:text-amber-300">{entry.business_name}</div>
        <div className="mt-1 text-xs text-zinc-500">View menu &amp; order online →</div>
      </div>
    </a>
  );
}

export default function RestaurantsDirectoryBlock({
  block,
  content,
  previewOnly,
}: {
  block: Block;
  content?: any;
  template?: any;
  colorMode?: 'light' | 'dark';
  previewOnly?: boolean;
}) {
  const c = pickContent(block, content);
  const campaignId: string = String(c?.campaign_id || '');
  const snapshot: Entry[] = Array.isArray(c?.entries) ? c.entries : [];

  const [live, setLive] = React.useState<Entry[] | null>(null);

  // Hydrate live cohort data (winner/published state changes without a republish).
  React.useEffect(() => {
    if (!campaignId) return;
    let alive = true;
    fetch(`/api/public/restaurant-directory?campaign=${encodeURIComponent(campaignId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && Array.isArray(j?.entries)) setLive(j.entries as Entry[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [campaignId]);

  const entries = sortEntries(live ?? snapshot);
  const featured = entries.find((e) => e.is_winner) ?? null;
  const rest = featured ? entries.filter((e) => e.template_id !== featured.template_id) : entries;
  const title: string = c?.title || '';

  if (!entries.length) {
    // Editor/empty state — keeps the block visible + explains what will appear.
    return (
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        {title && <h2 className="mb-4 text-center text-2xl font-bold">{title}</h2>}
        <div className="rounded-2xl border border-dashed border-zinc-700/70 px-6 py-14 text-center text-sm text-zinc-500">
          {previewOnly || campaignId
            ? 'Restaurants appear here automatically — the live contest cohort, winner featured first.'
            : 'Link this block to a restaurant competition (campaign_id) to list its cohort here.'}
        </div>
      </section>
    );
  }

  // Unlinked, text-only attribution — the SEO-safe branding across a network of
  // <city>-restaurant.com apexes (no sitewide followed links, no hero boilerplate).
  const brand = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || 'QuickSites';

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10">
      {title && <h2 className="mb-6 text-center text-2xl font-bold">{title}</h2>}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {featured && <Card entry={featured} featured />}
        {rest.map((e) => (
          <Card key={e.template_id} entry={e} />
        ))}
      </div>
      <div className="mt-10 border-t border-zinc-800/60 pt-4 text-center text-xs text-zinc-500">
        Order online, direct from the kitchen · powered by {brand}
      </div>
      {/* Operator curation. Renders NOTHING for anyone whose session isn't an admin — it
          probes an admin-gated endpoint and unmounts on 403, so no candidate names or
          campaign state reach a public visitor. The gate is the server's, not this flag.

          ⚠️ NOT in the editor (`previewOnly`, set by renderBlockRegistry as `!live`). The
          curator edits the LIVE public list, so inside the builder it was both wrong and in
          the way: a fixed-position panel floating over the canvas, colliding with the Shuffle
          button and the editor toolbar, offering to change something the editor doesn't
          control. Curate on the site; lay out blocks in the editor. */}
      {campaignId && !previewOnly ? <DirectoryCurator campaignId={campaignId} /> : null}
    </section>
  );
}
