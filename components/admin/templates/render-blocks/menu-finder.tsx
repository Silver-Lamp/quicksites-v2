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
import { filterItems, nearestAvailableFrom } from '@/lib/menu/cityMenuIndex';

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

  // Runs client-side so every keystroke is instant — the index is small (one city) and a
  // round-trip per character would feel worse than useless. It calls the SHARED filter rather
  // than a local copy: this block used to hand-roll its own "mirrors cityMenuIndex#narrow"
  // version, and two copies of one truth is the bug this repo keeps re-committing.
  const results = React.useMemo(
    () => filterItems(feed?.items ?? [], { tags: picked, query: q, openOnly }),
    [feed, picked, q, openOnly],
  );

  // What we can still offer when the search matched nothing — computed once, used to decide
  // whether cooking is even mentioned. See nearestAvailable() for why the order matters.
  const near = React.useMemo(
    () =>
      feed && results.length === 0
        ? nearestAvailableFrom(feed.items, { query: q.trim(), tags: picked, openOnly })
        : { kind: 'none' as const, items: [] as Item[] },
    [feed, results.length, q, picked, openOnly],
  );

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
        // Only 'none' is real unmet demand; the other rungs are our own hours/UI/index.
        zeroReason: results.length === 0 ? near.kind : undefined,
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
  }, [q, picked, openOnly, results.length, campaignId, feed, previewOnly, near.kind]);

  // Remedy probe: reset whenever the search changes, so the question is asked per zero-result
  // search rather than answered once and hidden for the session — otherwise the denominator
  // (zero-result searches) keeps growing while the numerator can't.
  const [cookIntent, setCookIntent] = React.useState(false);
  React.useEffect(() => { setCookIntent(false); }, [q, picked, openOnly]);

  const logCookIntent = React.useCallback(() => {
    if (previewOnly || !campaignId) return;
    const payload = JSON.stringify({
      campaignId,
      kind: 'cook_intent',
      query: q.trim(),
      tags: picked,
      resultCount: 0, // by construction — this only renders on a zero-result
      openOnly,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/public/menu-search-log', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/public/menu-search-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
      }
    } catch { /* the acknowledgement still shows; a lost log must never look like a failure */ }
  }, [previewOnly, campaignId, q, picked, openOnly]);

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
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Nothing matches that yet.{' '}
              <button onClick={() => { setPicked([]); setQ(''); setOpenOnly(false); }} className="underline">
                Start over
              </button>
              .
            </p>

            {/*
              REMEDY PROBE — measures whether a fix is wanted, before the fix is built.
              The search log proves the LEAK (a search matched nothing). It cannot prove that a
              recipe PLUGS it, and that is the question four sessions reasoned past: gated to
              zero-result, the audience is people who wanted a dish, while hungry, and didn't
              get it — the worst possible mood for a 40-minute project. So ask them.

              ⚠️ IT ASKS A QUESTION; IT DOES NOT PROMISE A FEATURE. "Want the recipe?" implies
              a recipe exists and dead-ends when tapped — the same dishonesty as the invented
              menus stripped off real restaurants this month. A door that says "would you" and
              then admits it isn't built measures the identical signal and lies to nobody.
            */}
            {/*
              GRADUATED, NOT COOK-FIRST. Lead with the strongest real answer we have. If the
              dish exists nearby and the kitchen is merely shut, "here it is, come back later"
              is both the honest answer and the useful one — and "nobody is OPEN" is simply not
              the same fact as "nobody SERVES it". Only the second is unmet demand.
            */}
            {near.kind === 'closed_now' && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                {near.items.length === 1 ? 'One place near you serves that' : `${near.items.length} dishes near you match`}
                {' '}— just not open right now.{' '}
                <button onClick={() => setOpenOnly(false)} className="font-medium underline">
                  Show them anyway
                </button>
              </p>
            )}
            {near.kind === 'naming' && (
              <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-sm text-zinc-300">
                Served nearby, spelled differently —{' '}
                <span className="font-medium text-zinc-100">
                  {near.items.slice(0, 3).map((i) => i.name).join(', ')}
                </span>
                {near.items.length > 3 ? ` and ${near.items.length - 3} more` : ''}.{' '}
                <button onClick={() => setQ(near.items[0].name)} className="font-medium underline">
                  Search that instead
                </button>
              </p>
            )}
            {near.kind === 'relaxed_tags' && (
              <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-sm text-zinc-300">
                No exact match, but {near.items.length} close{near.items.length === 1 ? ' one' : ' ones'} if you drop the filters.{' '}
                <button onClick={() => setPicked([])} className="font-medium underline">
                  Show those
                </button>
              </p>
            )}

            {/*
              Cook-it is the CONSOLATION, not the pitch — offered only once we genuinely have
              nothing. Beyond tone, this is what keeps the measurement honest: offering it to
              everyone who fails would count the prompt's prominence rather than real appetite,
              and would fold "the kitchen shut at 9" into "nobody makes this."
            */}
            {near.kind === 'none' && !previewOnly && campaignId && (q.trim() || picked.length > 0) && (
              cookIntent ? (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  Noted — thank you. We haven&rsquo;t built this yet; we&rsquo;re finding out
                  whether people want it first. All we recorded is that someone tapped, and what
                  they searched for.
                </p>
              ) : (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                  <p className="text-sm text-zinc-300">
                    Nobody near you is serving that right now — would you cook it yourself if we
                    showed you how?
                  </p>
                  <button
                    type="button"
                    onClick={() => { setCookIntent(true); logCookIntent(); }}
                    className="mt-2.5 rounded-md border border-sky-500/40 px-3 py-1.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/10"
                  >
                    Yes, I&rsquo;d cook it
                  </button>
                </div>
              )
            )}
          </div>
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
