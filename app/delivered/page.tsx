// app/delivered/page.tsx
//
// The delivered.menu apex: a directory of restaurants you can actually order from — and, since
// 2026-10-14, the kitchens we have built sites for that nobody has claimed yet, chipped as such.
// Middleware rewrites `delivered.menu/` here.
//
// ⚠️ TWO THINGS THIS PAGE GOT WRONG, BOTH WORTH KNOWING BEFORE EDITING.
//
// 1. IT ADVERTISED RESTAURANTS THAT WEREN'T. The old filter was
//    `industry === 'restaurant' || hasMenuBlock(...)`, which is far too loose: `industry`
//    is a *label*, not evidence of a menu. On the live fleet that admitted exactly two
//    listings under "2 restaurants taking orders", and neither could take an order —
//    `renton-restaurant` is a CITY DIRECTORY page (blocks: hero, restaurants_directory,
//    faq, contact_form) and `starter-restaurant` ("The Copper Kettle") is a STARTER
//    TEMPLATE with `meta.is_starter = true`. A public page promising "real menus from
//    spots near you" while listing our own directory and a demo is the same class of
//    dishonesty as the invented menus stripped off real restaurants in §4b — smaller, but
//    the same shape, and pointed at diners instead of owners.
//
//    So the rule is POSITIVE EVIDENCE (lib/delivered/listing.ts): a real `menu` block with real
//    items, and not a starter/demo/directory. Claimed and unclaimed are two kinds, never one
//    sorted list, and the page no longer COUNTS kitchens taking orders (owner, 2026-10-14) — one
//    chip per card says which is which instead.
//
// 2. IT FLASHED THE WRONG THEME. It was styled with literal light utilities plus `dark:`
//    variants. `app/providers.tsx` puts `data-theme="dark"` on a wrapper at SSR but the
//    `.dark` class on <html> only lands in a useEffect — so this page painted LIGHT and
//    flipped DARK after hydration, on every load. Now it uses the semantic tokens
//    (`bg-background` / `text-foreground` / `bg-card` / `border-border`), which key off the
//    `[data-theme]` wrapper and are therefore correct at first paint. See CLAUDE.md §7.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl, MENU_BASE_DOMAIN } from '@/lib/menu/deliveredMenu';
import { isOpenAt } from '@/lib/menu/cityMenuIndex';
import { classifyListing, hoursOf, isCityPortal, rankUnclaimed, UNCLAIMED_INITIAL, type ListingKind, type ListingRow } from '@/lib/delivered/listing';
import ShowMore from '@/components/delivered/show-more';
import PitchArt from '@/components/for-rep/pitch-art';
import { FOR_SALES_PITCHES } from '@/lib/sales/forSalesPitches';

/**
 * "Know of a great lunch spot?" — the /spread-the-word concept, above the fold here (owner,
 * 2026-10-14). The SENTENCE is imported, never retyped, so the two pages cannot drift; the link
 * is ABSOLUTE because this page serves on the delivered.menu host, where middleware rewrites a
 * relative `/spread-the-word` to a site path.
 */
const SPREAD_THE_WORD_URL = 'https://www.quicksites.ai/spread-the-word';

/**
 * The owner's Midjourney heroes for delivered.menu (2026-10-14, via HiveJournal's relay; the
 * PNG originals live in crosstalk/assets/delivered-menu-heroes). No people in any of them.
 * Served as sized WebP from public/ so `verify:assets` fails the build if one goes missing.
 * ⚠️ `street` carries text-SHAPED garble on the shop signs (not words — "PARODA"-ish); it sits
 * under a scrim with the headline over the left half so the signs stay small and dark. If the
 * owner re-rolls it, swap the file and nothing else changes.
 */
const HEROES = {
  street: '/delivered/heroes/street-blue-hour.webp', // diner homepage: a row of neighbourhood kitchens at blue hour
  bag: '/delivered/heroes/bag-on-doorstep.webp', // "it arrives": a takeaway bag under a porch light
  table: '/delivered/heroes/table-from-above.webp', // listing banner: many cuisines, one table
} as const;

export const metadata: Metadata = {
  title: 'Order from local restaurants — delivered.menu',
  description: 'Browse local restaurants and order online. Every site built and hosted on delivered.menu.',
  // Absolute on purpose: a bare path would resolve against metadataBase, which this project has
  // ~100 custom domains to pick wrongly from (the /spread-the-word lesson).
  openGraph: { images: [`https://www.quicksites.ai${HEROES.street}`] },
};

function prettifySlug(slug: string | null): string {
  return (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Card({ r, kind, now }: { r: ListingRow; kind: ListingKind; now: Date }) {
  const name = r.business_name?.trim() || prettifySlug(r.slug) || 'Restaurant';
  const img = r.hero_url || r.logo_url || null;
  const openNow = isOpenAt(hoursOf(r.data), now);

  return (
    <a
      href={menuSiteUrl(r.slug ?? '')}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/10"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          // A lone emoji on a grey box reads as "broken". A monogram on the brand gradient
          // reads as "this one has no photo yet", which is the truth.
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-5xl font-bold text-amber-500/40">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Only claim open/closed when the hours actually say so — null means unknown, and
            an unknown rendered as "Closed" sends a diner away from a kitchen that is serving. */}
        {openNow !== null && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${
              openNow
                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
                : 'bg-zinc-900/70 text-zinc-300 ring-1 ring-white/10'
            }`}
          >
            {openNow ? 'Open now' : 'Closed'}
          </span>
        )}

        {/* Claimed vs unclaimed, on every card. An unclaimed kitchen's menu came from its own
            public listing, post or site; nobody has confirmed those prices, so the card offers
            the menu, never an order. The chip says why the two kinds look different. */}
        {kind === 'claimed' ? (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-950 shadow" title="The restaurant has claimed this site and takes orders here.">
            Claimed
          </span>
        ) : (
          <span
            className="absolute right-3 top-3 rounded-full bg-zinc-900/80 px-2.5 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-white/15 backdrop-blur"
            title="We built this from the restaurant's public listing. Nobody has claimed it yet, so prices are unconfirmed — call to check."
          >
            Unclaimed
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-base font-semibold text-card-foreground">{name}</div>
        {r.industry_label && <div className="mt-0.5 text-xs text-muted-foreground">{r.industry_label}</div>}
        {kind === 'unclaimed' ? (
          <div className="mt-3 text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
            View menu <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </div>
        ) : (
          <div className="mt-3 text-sm font-medium text-amber-500 transition group-hover:text-amber-400">
            Order online <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </div>
        )}
      </div>
    </a>
  );
}

function CityCard({ r }: { r: ListingRow }) {
  const name = r.business_name?.trim() || prettifySlug(r.slug) || 'City';
  return (
    <a
      href={menuSiteUrl(r.slug ?? '')}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3.5 transition hover:border-amber-500/40 hover:bg-amber-500/5"
    >
      <span className="font-medium text-card-foreground">{name}</span>
      <span className="text-sm text-amber-500 transition group-hover:translate-x-0.5">Browse →</span>
    </a>
  );
}

export default async function DeliveredDirectoryPage() {
  const now = new Date();

  const [{ data }, { data: ops }] = await Promise.all([
    supabaseAdmin
      .from('templates')
      .select('slug, business_name, industry, industry_label, hero_url, logo_url, data, claim_source, owner_id, published, is_site')
      .eq('archived', false)
      // Live sites, plus the operator-built pre-claim drafts (the same two claim sources the
      // menu host itself will render to the public). NO is_version filter — deliberately.
      // `is_version` does NOT reliably mean "version snapshot": on the live fleet 50 of 66
      // published sites carry is_version=true, so filtering on false excluded 76% of real
      // sites. `is_site && published && !archived` is what identifies a live site.
      .or('and(is_site.eq.true,published.eq.true),claim_source.in.(listing_import,operator_draft)')
      .order('updated_at', { ascending: false })
      .limit(600),
    supabaseAdmin.from('admin_users').select('user_id'),
  ]);

  const operatorIds = new Set(((ops ?? []) as Array<{ user_id: string }>).map((o) => o.user_id));
  const all: ListingRow[] = (data as ListingRow[]) ?? [];
  const claimed: ListingRow[] = [];
  const unclaimedRaw: ListingRow[] = [];
  for (const r of all) {
    const kind = classifyListing(r, operatorIds);
    if (kind === 'claimed') claimed.push(r);
    else if (kind === 'unclaimed') unclaimedRaw.push(r);
  }
  const unclaimed = rankUnclaimed(unclaimedRaw);
  const cities = all.filter((r) => !!r.slug && !!r.is_site && !!r.published && isCityPortal(r));
  const any = claimed.length + unclaimed.length > 0;

  const brand = MENU_BASE_DOMAIN || 'delivered.menu';

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* Warm ambient wash — pure CSS off the brand accent, so it costs nothing and cannot
          404 the way a background image can. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(245,158,11,0.14),transparent_70%)]"
      />

      <header className="relative overflow-hidden border-b border-border">
        {/* The street at blue hour, behind a scrim that keeps the headline legible on the left and
            the (garbled) shop signs small and dark on the right. Decorative: alt is empty. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HEROES.street} alt="" className="h-full w-full object-cover object-center opacity-80" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/15" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">{brand}</div>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Order straight from the kitchen.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Real menus from local spots — order online in a couple of taps.{' '}
            {any && (
              <span className="text-foreground">
                No apps, no markups, no middleman taking a third of the bill.
              </span>
            )}
          </p>

          {/* Know a great lunch spot? One frosted card, the same sentence as /spread-the-word,
              one button. It sits inside the hero so it is above the fold on a phone without
              pushing the page's own headline down. */}
          <a
            href={SPREAD_THE_WORD_URL}
            className="group mt-8 flex max-w-xl items-center gap-4 rounded-2xl border border-amber-500/40 bg-card/70 p-4 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/15 backdrop-blur transition hover:border-amber-400 hover:bg-card/90"
          >
            <span className="hidden shrink-0 sm:block [&>svg]:h-16 [&>svg]:w-16">
              <PitchArt kind="lunch" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-card-foreground">{FOR_SALES_PITCHES.lunch}</span>
              <span className="mt-1 block text-sm font-medium text-amber-500 transition group-hover:text-amber-400">
                Tell us about them <span className="inline-block transition group-hover:translate-x-0.5">→</span>
              </span>
            </span>
          </a>
        </div>
      </header>

      {/* Listing banner: one table, several cuisines — what a directory of kitchens looks like
          before any single restaurant is named. No count, no claim. */}
      <section className="relative mx-auto max-w-6xl px-6 pt-10">
        <div className="relative h-40 overflow-hidden rounded-2xl border border-border sm:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HEROES.table} alt="" className="h-full w-full object-cover object-center" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 sm:bottom-5 sm:left-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">Local kitchens</div>
            <div className="mt-1 text-lg font-semibold text-foreground sm:text-xl">Ordered straight from the kitchen that cooks it.</div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-10">
        {any ? (
          <>
            {unclaimed.length > 0 && (
              <p className="mb-5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Claimed</span> kitchens take orders here.{' '}
                <span className="font-medium text-foreground">Unclaimed</span> ones are sites we built from a
                restaurant&rsquo;s own public listing — the menu is theirs, the prices are unconfirmed, and the
                kitchen hasn&rsquo;t taken the site over yet. Call to check before you count on it.
              </p>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {claimed.map((r) => (
                <Card key={r.slug} r={r} kind="claimed" now={now} />
              ))}
              <ShowMore initial={UNCLAIMED_INITIAL} moreLabel="more unclaimed kitchens">
                {unclaimed.map((r) => (
                  <Card key={r.slug} r={r} kind="unclaimed" now={now} />
                ))}
              </ShowMore>
            </div>
          </>
        ) : (
          /* The honest empty state. It used to say "2 restaurants taking orders" while
             listing a directory page and a demo; saying "none yet" is both true and, for a
             diner, far less annoying than tapping through to a restaurant that isn't one. */
          <div className="rounded-2xl border border-border bg-card p-10 sm:p-14">
            <div className="text-4xl">🍜</div>
            <h2 className="mt-5 text-2xl font-semibold text-card-foreground">
              No kitchens here yet.
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              We build free ordering sites for local restaurants — the ones with no website, or a
              menu trapped in a photo on someone else&rsquo;s app. When they go live, they show up
              here.
            </p>

            {cities.length > 0 && (
              <div className="mt-8">
                <div className="text-sm font-medium text-foreground">In the meantime, browse a city</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {cities.map((r) => (
                    <CityCard key={r.slug} r={r} />
                  ))}
                </div>
              </div>
            )}

            <a
              href="/restaurants"
              className="mt-9 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              Run a restaurant? Get your free site →
            </a>
          </div>
        )}
      </section>

      {/* Cities also belong on a populated page — they're how someone finds the next town
          over, and they are honestly labelled as cities rather than counted as restaurants. */}
      {any && cities.length > 0 && (
        <section className="relative mx-auto max-w-6xl px-6 pb-14">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Browse by city
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((r) => (
              <CityCard key={r.slug} r={r} />
            ))}
          </div>
        </section>
      )}

      {/* How it works, for a diner: three steps beside the bag on the doorstep. Each step is
          something the product does today — find, order direct, collect or get it brought. */}
      <section className="relative border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 md:grid-cols-2 md:items-center">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HEROES.bag} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">How it works</h2>
            <ol className="mt-6 space-y-5">
              {[
                ['Find a kitchen', 'Browse the restaurants here, or open one straight from its own address.'],
                ['Order direct', 'The menu is the restaurant’s own. Your order goes to their kitchen, not through an app that takes a cut.'],
                ['It arrives', 'Pick it up, or have it brought over where the restaurant offers that. Either way, they got the whole order.'],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-zinc-950">{i + 1}</span>
                  <div>
                    <div className="font-semibold text-foreground">{title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-border px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Every restaurant here runs on a free site we built for them. We earn only when you order.
        </p>
        <a
          href="/restaurants"
          className="mt-3 inline-block text-sm font-semibold text-amber-500 underline-offset-4 hover:underline"
        >
          Own a restaurant? Claim a free ordering site →
        </a>
      </footer>
    </main>
  );
}
