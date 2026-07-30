// app/delivered/page.tsx
//
// The delivered.menu apex: a directory of restaurants you can actually order from.
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
//    So the rule is now POSITIVE EVIDENCE: a real `menu` block with real items, and not a
//    starter/demo/directory. If that yields nothing, the page says so. An empty directory
//    is a fact about the business, not a bug to paper over — and "0 restaurants" is
//    recoverable, whereas a diner who taps through to a demo and finds no food is not.
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
import { readMenuSections, isPlaceholderOnly } from '@/lib/menu/menuBlocks';

type Row = {
  slug: string | null;
  business_name: string | null;
  industry: string | null;
  industry_label: string | null;
  hero_url: string | null;
  logo_url: string | null;
  data: any;
};

export const metadata: Metadata = {
  title: 'Order from local restaurants — delivered.menu',
  description: 'Browse local restaurants and order online. Every site built and hosted on delivered.menu.',
};

function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
}

/** Blocks from whichever shape this row uses — the fleet carries both. */
function blocksOf(data: any): any[] {
  const page = safeParse(data)?.pages?.[0] ?? {};
  return [...(page.content_blocks ?? []), ...(page.blocks ?? [])];
}

const blockTypes = (data: any) => new Set(blocksOf(data).map((b) => b?.type));

/**
 * Can a diner actually order here?
 *
 * Positive evidence only. A `menu` block whose items are all scaffold placeholders is a
 * template wearing a restaurant's clothes, so `isPlaceholderOnly` is part of the test —
 * the same helper that stopped us shipping invented menus onto real businesses.
 */
function isOrderableRestaurant(r: Row): boolean {
  const meta = safeParse(r.data)?.meta ?? {};
  if (meta.is_starter || meta.is_demo) return false; // a demo is not a restaurant
  const types = blockTypes(r.data);
  if (types.has('restaurants_directory')) return false; // a directory is not a restaurant
  if (!types.has('menu')) return false;
  const sections = readMenuSections(safeParse(r.data));
  return sections.length > 0 && !isPlaceholderOnly(sections);
}

/** A city cohort page — real and useful, but listed as a city, never as a restaurant. */
function isCityPortal(r: Row): boolean {
  return blockTypes(r.data).has('restaurants_directory');
}

function hoursOf(data: any): any | null {
  for (const b of blocksOf(data)) if (b?.type === 'hours') return b.content ?? b.props ?? null;
  return null;
}

function prettifySlug(slug: string | null): string {
  return (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Card({ r, now }: { r: Row; now: Date }) {
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
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-base font-semibold text-card-foreground">{name}</div>
        {r.industry_label && <div className="mt-0.5 text-xs text-muted-foreground">{r.industry_label}</div>}
        <div className="mt-3 text-sm font-medium text-amber-500 transition group-hover:text-amber-400">
          Order online <span className="inline-block transition group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </a>
  );
}

function CityCard({ r }: { r: Row }) {
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

  const { data } = await supabaseAdmin
    .from('templates')
    .select('slug, business_name, industry, industry_label, hero_url, logo_url, data')
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    // NO is_version filter — deliberately. `is_version` does NOT reliably mean "version
    // snapshot": on the live fleet 50 of 66 published sites carry is_version=true, so
    // filtering on false excluded 76% of real sites. `is_site && published && !archived` is
    // what actually identifies a live site. (Verified zero duplicate slugs across that set.)
    .order('updated_at', { ascending: false })
    .limit(200);

  const all: Row[] = (data as Row[]) ?? [];
  const rows = all.filter((r) => !!r.slug && isOrderableRestaurant(r));
  const cities = all.filter((r) => !!r.slug && isCityPortal(r));

  const brand = MENU_BASE_DOMAIN || 'delivered.menu';

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* Warm ambient wash — pure CSS off the brand accent, so it costs nothing and cannot
          404 the way a background image can. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(245,158,11,0.14),transparent_70%)]"
      />

      <header className="relative border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">{brand}</div>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Order straight from the kitchen.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Real menus from local spots — order online in a couple of taps.{' '}
            {rows.length > 0 && (
              <span className="text-foreground">
                No apps, no markups, no middleman taking a third of the bill.
              </span>
            )}
          </p>

          {rows.length > 0 && (
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {rows.length} restaurant{rows.length === 1 ? '' : 's'} taking orders
            </div>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 py-14">
        {rows.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <Card key={r.slug} r={r} now={now} />
            ))}
          </div>
        ) : (
          /* The honest empty state. It used to say "2 restaurants taking orders" while
             listing a directory page and a demo; saying "none yet" is both true and, for a
             diner, far less annoying than tapping through to a restaurant that isn't one. */
          <div className="rounded-2xl border border-border bg-card p-10 sm:p-14">
            <div className="text-4xl">🍜</div>
            <h2 className="mt-5 text-2xl font-semibold text-card-foreground">
              No kitchens taking orders here yet.
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
      {rows.length > 0 && cities.length > 0 && (
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
