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
  // ⚠️ NO `colorMode`. It was declared here and never read — so the file LOOKED theme-aware to
  // every reader while hard-coding the dark palette throughout, which is the same unused-prop
  // trap SectionShell fell into (see components/ui/__tests__/sectionShellColor.test.ts). The
  // block is theme-aware now because it uses semantic tokens, which need no prop at all.
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

  type Group = {
    url: string;
    openNow: boolean | null;
    items: Item[];
    unclaimed: boolean;
    phone: string | null;
  };

  /**
   * ⚠️ CLAIMED AND UNCLAIMED ARE TWO LISTS, NOT ONE SORTED LIST. Merging them and relying on an
   * ordering would make the distinction a visual convention that the next layout change silently
   * drops. Splitting them means an unclaimed kitchen can never occupy a claimed one's position,
   * and the section heading carries the caveat once instead of every row repeating it.
   */
  const [claimedGroups, unclaimedGroups] = React.useMemo<[Array<[string, Group]>, Array<[string, Group]>]>(() => {
    const m = new Map<string, Group>();
    for (const i of results) {
      const cur: Group = m.get(i.restaurantName) ?? {
        url: i.restaurantUrl,
        openNow: i.openNow,
        items: [] as Item[],
        unclaimed: !!(i as any).unclaimed,
        phone: (i as any).restaurantPhone ?? null,
      };
      cur.items.push(i);
      m.set(i.restaurantName, cur);
    }
    const all: Array<[string, Group]> = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return [all.filter(([, r]) => !r.unclaimed), all.filter(([, r]) => r.unclaimed)];
  }, [results]);

  const byRestaurant = claimedGroups;

  /**
   * Real restaurants in this city that we do NOT host, fetched only on a genuine zero result.
   *
   * ⚠️ THE SWEEP KNOWS THE CITY; THE INDEX ONLY KNOWS OUR FOUR KITCHENS. Answering "nobody serves
   * that" from a four-restaurant index was the bug fixed in #727; this is the other half — having
   * softened the claim, actually help. Reads our own already-collected lead data, never a live
   * third-party lookup on a public endpoint.
   */
  const [nearby, setNearby] = React.useState<Array<{
    name: string; phone: string | null; address: string | null;
    rating: number | null; reviewCount: number | null; matchReason: 'name' | 'category';
  }>>([]);

  React.useEffect(() => {
    if (previewOnly || !campaignId || near.kind !== 'none' || !q.trim()) {
      setNearby([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/public/city-nearby?campaign=${encodeURIComponent(campaignId)}&q=${encodeURIComponent(q)}`,
        );
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setNearby(Array.isArray(j?.matches) ? j.matches : []);
      } catch {
        /* a missing suggestion is a quieter failure than a broken page */
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [previewOnly, campaignId, near.kind, q]);

  if (previewOnly || !campaignId) {
    return (
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {campaignId
            ? 'Menu search — live on the published site.'
            : 'Link this block to a city campaign (campaign_id) to search its menus.'}
        </p>
      </section>
    );
  }

  // ⚠️ THIS USED TO `return null` UNTIL THE FEED ARRIVED, WHICH MEANT THE SEARCH DID NOT EXIST
  // SERVER-SIDE AT ALL. The old comment called it "no skeleton: the block simply isn't there
  // until it has data" — a reasonable-sounding choice with two costs nobody priced:
  //   1. A crawler, a slow connection, or a no-JS first paint saw a 4-restaurant list where the
  //      page's actual product is a city-wide dish search. The thing we want to rank for was
  //      absent from the bytes we serve.
  //   2. It cannot be "the first thing on the page" if it is not in the first RENDER. Any
  //      argument about where to put the search was moot while it arrived late.
  // Found by HiveJournal fetching the served HTML — the same instrument that keeps catching this
  // class, and the one I had already run today without connecting what it showed.
  //
  // The heading and the input now render immediately; only the COUNT waits for data, because a
  // count is a claim and an invented one would be worse than a late one.
  const total = feed?.items.length ?? 0;

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {feed
          ? `${total} dishes across ${feed.restaurants.length} kitchens${feed.city ? ` in ${feed.city}` : ''}.`
          : 'Search every dish on the menus we have.'}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tacos, noodles, something vegan…"
          className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-400/60"
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-foreground">
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
              className="rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-medium text-foreground"
            >
              {t} ✕
            </button>
          ))}
          <button onClick={() => setPicked([])} className="text-xs text-muted-foreground underline">
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
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground transition hover:border-amber-500/50 hover:text-foreground"
            >
              {tag} <span className="text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-7 space-y-6">
        {byRestaurant.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
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
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
                {near.items.length === 1 ? 'One place near you serves that' : `${near.items.length} dishes near you match`}
                {' '}— just not open right now.{' '}
                <button onClick={() => setOpenOnly(false)} className="font-medium underline">
                  Show them anyway
                </button>
              </p>
            )}
            {near.kind === 'naming' && (
              <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                Served nearby, spelled differently —{' '}
                <span className="font-medium text-foreground">
                  {near.items.slice(0, 3).map((i) => i.name).join(', ')}
                </span>
                {near.items.length > 3 ? ` and ${near.items.length - 3} more` : ''}.{' '}
                <button onClick={() => setQ(near.items[0].name)} className="font-medium underline">
                  Search that instead
                </button>
              </p>
            )}
            {near.kind === 'relaxed_tags' && (
              <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
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
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-foreground">
                  Noted — thank you. We haven&rsquo;t built this yet; we&rsquo;re finding out
                  whether people want it first. All we recorded is that someone tapped, and what
                  they searched for.
                </p>
              ) : (
                <div className="rounded-lg border border-border bg-muted p-3">
                  {/* ⚠️ "NOBODY NEAR YOU" WAS A CLAIM ABOUT THE WORLD MADE FROM OUR DATABASE.
                      This index covers the kitchens on THIS page — 4 of them in Renton. A visitor
                      searching "thai" got "nobody near you is serving that" while 20 Thai
                      restaurants sit within 8km (checked via Places, 2026-08-09). The existing
                      design note here already separates "nobody is OPEN" from "nobody SERVES it";
                      this is the same distinction one level further out, and the one that was
                      missed: OUR INDEX is not THE WORLD. Say what we actually know — and the
                      cook-it probe only measures appetite honestly if the premise above it is
                      true, since a visitor who believes "nobody nearby" is answering a different
                      question than one who knows we simply don't list it yet. */}
                  <p className="text-sm text-foreground">
                    No kitchen on this page has that yet — we&rsquo;re still adding them. Would you
                    cook it yourself if we showed you how?
                  </p>
                  <button
                    type="button"
                    onClick={() => { setCookIntent(true); logCookIntent(); }}
                    className="mt-2.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/10"
                  >
                    Yes, I&rsquo;d cook it
                  </button>
                </div>
              )
            )}

            {/*
              ⚠️ THE HELPFUL ANSWER, AND THE LIMIT OF WHAT WE CAN HONESTLY SAY. These come from our
              own city sweep, so we know the business and its CUISINE — we have never seen their
              menu. So the heading says "restaurants", never "serving <dish>", and no dish or price
              is shown: asserting that a kitchen serves something we never read is the same
              invention as quoting a price we cannot date.

              They are not on delivered.menu and get nothing that treats them as a lead — a name,
              a phone number, an address. No claim bar, no attribution, no tracking link. The
              visitor came here hungry; sending them somewhere real is the whole job, and doing it
              without a catch is what makes the page worth returning to.
            */}
            {near.kind === 'none' && nearby.length > 0 && (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-sm text-foreground">
                  Not on delivered.menu, but nearby in {feed?.city ?? 'town'} — call them direct:
                </p>
                <ul className="mt-2 space-y-2">
                  {nearby.map((m) => (
                    <li key={m.name} className="text-sm">
                      <span className="font-medium text-foreground">{m.name}</span>
                      {m.phone && (
                        <>
                          {' · '}
                          <a
                            href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {m.phone}
                          </a>
                        </>
                      )}
                      {typeof m.rating === 'number' && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {m.rating.toFixed(1)}★{m.reviewCount ? ` (${m.reviewCount})` : ''}
                        </span>
                      )}
                      {m.address && <div className="text-xs text-muted-foreground">{m.address}</div>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  We haven&rsquo;t seen their menu — this is a local restaurant of that kind, not a
                  promise they serve what you searched for.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
          {byRestaurant.map(([name, r]) => (
            <div key={name}>
              <div className="flex items-baseline gap-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-foreground hover:underline">
                  {name}
                </a>
                {/* Three states, never two — unknown hours must not read as closed. */}
                {r.openNow === true && <span className="text-xs font-medium text-emerald-600">open now</span>}
                {r.openNow === false && <span className="text-xs text-muted-foreground">closed</span>}
                {r.openNow === null && <span className="text-xs text-muted-foreground">hours unknown</span>}
              </div>
              <ul className="mt-2 divide-y divide-border">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{i.name}</div>
                      {i.description && <div className="text-xs text-muted-foreground">{i.description}</div>}
                    </div>
                    {i.price && (
                      // "call to confirm" is substituted upstream in cityMenuIndex; rendered
                      // dimmer so it reads as a caveat rather than a price.
                      <div className={`shrink-0 text-sm ${i.priceUnconfirmed ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                        {i.price}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/*
            ⚠️ UNCLAIMED KITCHENS — a real menu, transcribed from the restaurant's own public
            listing photos, on a page they have not claimed. They are shown because withholding a
            real dinner option protects nobody, and shown SEPARATELY, BELOW, and WITHOUT an order
            path because they have agreed to nothing and confirmed no price. The only action is
            their own public phone number: the same thing a search engine offers, and exactly what
            this site already tells diners to do ("call them direct").
            The gap between these rows and the ones above IS the pitch to the owner.
          */}
          {unclaimedGroups.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              {/*
                ⚠️ THE LABEL IS WHAT MAKES THE ORDERING HONEST, NOT THE ORDERING ITSELF (HJ's
                challenge, 2026-08-10, and they were right). "Also serving nearby" reads as
                position-implies-rank, and a cynical diner — or an owner — will assume the ones on
                top paid us. Naming the axis as TRUST removes that reading: the sections are split
                by what we can stand behind, and the sentence says so out loud. Same move as rule
                9's lineage — name the absence rather than hoping the structure implies it.
              */}
              <h3 className="text-sm font-semibold text-foreground">
                Listed from public info — call to confirm
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                We haven&rsquo;t seen these menus ourselves — we read them off each restaurant&rsquo;s
                public listing, so there are no prices here and nothing to order online. The
                kitchens above confirmed theirs. Call these to check what&rsquo;s on today.
              </p>
              <div className="mt-4 space-y-5">
                {unclaimedGroups.map(([name, r]) => (
                  <div key={name}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-foreground hover:underline"
                      >
                        {name}
                      </a>
                      {r.phone ? (
                        <a
                          href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {r.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">no phone listed</span>
                      )}
                      {r.openNow === true && (
                        <span className="text-xs font-medium text-emerald-600">open now</span>
                      )}
                      {r.openNow === null && <span className="text-xs text-muted-foreground">hours unknown</span>}
                    </div>
                    <ul className="mt-1.5 text-sm text-muted-foreground">
                      {r.items.slice(0, 4).map((i) => (
                        <li key={i.id} className="py-0.5">
                          {i.name}
                          {/* ⚠️ No price at all here, not even a dimmed one. On a page nobody has
                              claimed, a number beside a dish reads as a quote from the restaurant. */}
                        </li>
                      ))}
                      {r.items.length > 4 && (
                        <li className="py-0.5 text-xs text-muted-foreground">
                          +{r.items.length - 4} more on their menu
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </section>
  );
}
