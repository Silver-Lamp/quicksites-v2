'use client';

// components/admin/templates/render-blocks/menu-finder.tsx
//
// "What are you hungry for?" — a narrowing tag search across every dish in a city cohort.
//
// The interaction: pick a craving, the list narrows, and the chips you're offered next are
// only those that still lead somewhere. A chip that would empty the page is never shown —
// that property lives in lib/menu/cityMenuIndex.ts (nextTags) and is unit-tested, because a
// search that can dead-end feels broken in a way no amount of styling fixes.
//
// "Open now" defaults OFF. A restaurant with unreadable hours reads as unknown, not closed,
// and defaulting the filter on would silently hide kitchens that are actually serving.
import * as React from 'react';
import type { Block } from '@/types/blocks';

type Item = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  tags: string[];
  restaurantName: string;
  restaurantUrl: string;
  openNow: boolean | null;
  priceUnconfirmed?: boolean;
};

type Feed = {
  city?: string;
  items: Item[];
  tags: Array<{ tag: string; count: number }>;
  restaurants: Array<{ slug: string; name: string; openNow: boolean | null }>;
};

function pickContent(block: any, content?: any): any {
  return content ?? block?.content ?? block?.props ?? {};
}

const norm = (t: string) => String(t ?? '').trim().toLowerCase();

export default function MenuFinderBlock({
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
  const campaignId = String(c?.campaign_id || '');
  const title = String(c?.title || 'What are you hungry for?');

  const [feed, setFeed] = React.useState<Feed | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [q, setQ] = React.useState('');
  const [openOnly, setOpenOnly] = React.useState(false);

  React.useEffect(() => {
    if (!campaignId || previewOnly) return;
    let alive = true;
    fetch(`/api/public/city-menu-search?campaign=${encodeURIComponent(campaignId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.items) setFeed(j as Feed);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [campaignId, previewOnly]);

  // Mirrors lib/menu/cityMenuIndex.ts#narrow. Kept client-side so every keystroke is instant;
  // the index is small (one city) and a round-trip per character would feel worse than useless.
  const results = React.useMemo(() => {
    const items = feed?.items ?? [];
    const sel = picked.map(norm);
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (openOnly && i.openNow !== true) return false;
      if (sel.length && !sel.every((t) => i.tags.includes(t))) return false;
      if (query && !`${i.name} ${i.description ?? ''} ${i.restaurantName}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [feed, picked, q, openOnly]);

  const offered = React.useMemo(() => {
    const sel = new Set(picked.map(norm));
    const counts = new Map<string, number>();
    for (const i of results) for (const t of i.tags) if (!sel.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 14);
  }, [results, picked]);

  // ── Unmet-demand capture ────────────────────────────────────────────────────────────────
  // The ZERO-RESULT searches are the product: "47 people wanted vegan pad thai here and found
  // nobody" is revenue that doesn't exist yet, and no incumbent sells it. This filtering is
  // client-side, so without this every no-result search evaporated when the visitor gave up.
  //
  // Debounced to a SETTLED search, not per keystroke — "p", "pa", "pad" are not three demand
  // signals. sendBeacon + ignored response: a dropped log must never be visible to someone
  // who is just trying to find dinner. No identifiers are sent (see the route).
  React.useEffect(() => {
    if (previewOnly || !campaignId || !feed) return;
    if (!q.trim() && picked.length === 0) return;
    const t = setTimeout(() => {
      const payload = JSON.stringify({
        campaignId,
        query: q.trim(),
        tags: picked,
        resultCount: results.length,
        openOnly,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/public/menu-search-log', new Blob([payload], { type: 'application/json' }));
        } else {
          void fetch('/api/public/menu-search-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
        }
      } catch { /* never surface a logging failure to a hungry visitor */ }
    }, 900);
    return () => clearTimeout(t);
  }, [q, picked, openOnly, results.length, campaignId, feed, previewOnly]);

  const byRestaurant = React.useMemo(() => {
    const m = new Map<string, { url: string; openNow: boolean | null; items: Item[] }>();
    for (const i of results) {
      const cur = m.get(i.restaurantName) ?? { url: i.restaurantUrl, openNow: i.openNow, items: [] };
      cur.items.push(i);
      m.set(i.restaurantName, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  if (previewOnly || !campaignId) {
    return (
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {campaignId
            ? 'Menu search — live on the published site.'
            : 'Link this block to a city campaign (campaign_id) to search its menus.'}
        </p>
      </section>
    );
  }

  if (!feed) return null; // no skeleton: the block simply isn't there until it has data

  const total = feed.items.length;

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {total} dishes across {feed.restaurants.length} kitchens
        {feed.city ? ` in ${feed.city}` : ''}.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tacos, noodles, something vegan…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400/60"
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4" />
          Open now
        </label>
      </div>

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {picked.map((t) => (
            <button
              key={t}
              onClick={() => setPicked((p) => p.filter((x) => x !== t))}
              className="rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200"
            >
              {t} ✕
            </button>
          ))}
          <button onClick={() => setPicked([])} className="text-xs text-zinc-400 underline">
            clear
          </button>
        </div>
      )}

      {offered.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offered.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setPicked((p) => [...p, tag])}
              className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-200"
            >
              {tag} <span className="text-zinc-500">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-7 space-y-6">
        {byRestaurant.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Nothing matches that yet.{' '}
            <button onClick={() => { setPicked([]); setQ(''); setOpenOnly(false); }} className="underline">
              Start over
            </button>
            .
          </p>
        ) : (
          byRestaurant.map(([name, r]) => (
            <div key={name}>
              <div className="flex items-baseline gap-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-zinc-100 hover:underline">
                  {name}
                </a>
                {/* Three states, never two — unknown hours must not read as closed. */}
                {r.openNow === true && <span className="text-xs font-medium text-emerald-400">open now</span>}
                {r.openNow === false && <span className="text-xs text-zinc-500">closed</span>}
                {r.openNow === null && <span className="text-xs text-zinc-600">hours unknown</span>}
              </div>
              <ul className="mt-2 divide-y divide-zinc-800/70">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100">{i.name}</div>
                      {i.description && <div className="text-xs text-zinc-400">{i.description}</div>}
                    </div>
                    {i.price && (
                      // "call to confirm" is substituted upstream in cityMenuIndex; rendered
                      // dimmer so it reads as a caveat rather than a price.
                      <div className={`shrink-0 text-sm ${i.priceUnconfirmed ? 'text-zinc-500 italic' : 'text-zinc-300'}`}>
                        {i.price}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
