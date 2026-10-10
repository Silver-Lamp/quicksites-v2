// app/for-abdou/page.tsx
//
// Personal, UNLISTED page for Abdou — new to Vashon Island, commuting off-island for work, and
// looking for something he can do ON the island (his own words, FB Vashon group, 2026-10-07).
// Public URL, noindex, linked from nowhere — Sandon texts him the link. Same pattern as
// /for-angela: native <details>, no JS, every dollar figure derived from the constants.
//
// ⚠️ THE ISLAND IS THE WHOLE PITCH, AND IT IS WRITTEN HONESTLY. Vashon has one road, a ferry
// at each end, and a few hundred businesses that mostly know each other. What he can do that
// we cannot is walk in. What is and isn't real is said plainly below, and READ LIVE where it can
// be: the island sweep (the no-website table), the vashon-<trade>.com sites and how many forward
// calls or have rented (geo_industry_campaigns). ⚠️ This card said "no island site exists, no
// sweep has run" for two days after both were true (found 2026-10-10 on the served page) — a
// typed "0 built" is a count that rots, on the one page where a wrong number costs someone's
// trust. "Straight talk" is load-bearing for someone who needs the income to be real.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT } from '@/lib/commerce/partner-terms';
import { SPLIT } from '@/lib/commerce/rentalSplits';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { KEY_TO_LABEL } from '@/lib/industries';
import { mintRepActionToken } from '@/lib/rep/repActionToken';
import { repBuildLinks } from '@/lib/rep/repBuild';
import NoSiteTable, { type NoSiteRow as TableRow } from '@/components/for-rep/no-site-table';
import { groupRestaurantsByOrdering, platformLabel, platformFromWebsiteHost, looksLikeFoodBusiness, type RestaurantRow } from '@/lib/prospects/orderingSegments';
import RestaurantTable, { type RestaurantTableRow } from '@/components/for-rep/restaurant-table';
import { breakEvenOrders } from '@/lib/compare/toast';

// The island list is read live: a re-sweep changes it, and a date on the section says how
// fresh it is. Never a hand-typed table — that is a count that rots.
export const dynamic = 'force-dynamic';

type NoSiteRow = {
  id: string;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  industry_key: string | null;
  rating: number | null;
  review_count: number | null;
  last_seen_at: string | null;
  template_id: string | null;
  templates: { slug: string | null } | null;
};

/**
 * Island businesses Google lists with no website, from the parked sweep rows.
 *
 * ⚠️ Only rows with a phone: a listing with no phone and no rating is often not a business at
 * all (a person's name, a closed venue), and a list someone will walk is not the place for a
 * guess. Only what Google itself shows — name, trade, phone, street, rating. Nothing is added.
 */
async function loadIslandNoSite(): Promise<{ rows: NoSiteRow[]; sweptOn: string | null }> {
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, address, industry_key, rating, review_count, last_seen_at, template_id')
    .eq('city', 'Vashon')
    .eq('region', 'WA')
    .not('phone', 'is', null)
    .or('website.is.null,website.eq.,website.eq.no site')
    .limit(200);
  // ⚠️ A SECOND QUERY, NOT AN EMBED. `templates:template_id ( slug )` is not a declared foreign
  // key, so PostgREST answers the whole select with an error and the page rendered an EMPTY
  // table on production (2026-10-08) while reading as "no businesses". Two plain queries cannot
  // fail that way.
  const base = ((data ?? []) as unknown as Omit<NoSiteRow, 'templates'>[]).filter((r) => (r.business_name ?? '').trim());
  const templateIds = base.map((r) => r.template_id).filter((id): id is string => !!id);
  const slugById = new Map<string, string>();
  if (templateIds.length) {
    const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug').in('id', templateIds);
    for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null }>) if (t.slug) slugById.set(t.id, t.slug);
  }
  const rows: NoSiteRow[] = base
    .map((r) => ({ ...r, templates: r.template_id && slugById.has(r.template_id) ? { slug: slugById.get(r.template_id)! } : null }))
    .sort((a, b) => tradeLabel(a.industry_key).localeCompare(tradeLabel(b.industry_key)) || (b.review_count ?? 0) - (a.review_count ?? 0));
  const sweptOn = rows.reduce<string | null>((m, r) => (r.last_seen_at && (!m || r.last_seen_at > m) ? r.last_seen_at : m), null);
  return { rows, sweptOn };
}

/**
 * The vashon-<trade>.com campaign sites, counted live. ⚠️ `attached` means attached to Vercel, not
 * owned (CLAUDE.md §8) — but every Vashon domain was bought through the Vercel registrar or is the
 * owner's own, and the nightly backfill writes `unregistered` for any that is not, so counting
 * registered/attached is the honest number here. `payment_count > 0` is the only proof of rent.
 */
async function loadIslandSites(): Promise<{ built: number; forwarding: number; rented: number }> {
  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('domain, domain_status, forward_to, payment_count')
    .ilike('domain', 'vashon-%')
    .in('domain_status', ['registered', 'attached']);
  const rows = (data ?? []) as Array<{ domain: string; forward_to: string | null; payment_count: number | null }>;
  return {
    built: rows.length,
    forwarding: rows.filter((r) => !!r.forward_to).length,
    rented: rows.filter((r) => (r.payment_count ?? 0) > 0).length,
  };
}

/**
 * Island restaurants WITH a website, and what their own site says about online ordering
 * (`ordering_platform`, read by lib/prospects/orderingCheck.ts). NULL checked_at is "nobody
 * looked", shown as its own count — never folded into "no ordering found".
 */
async function loadIslandRestaurants(): Promise<{ rows: (RestaurantRow & { slug: string | null })[]; checkedOn: string | null }> {
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, website, rating, review_count, ordering_platform, ordering_checked_at, template_id, categories')
    .eq('city', 'Vashon')
    .eq('region', 'WA')
    .eq('industry_key', 'restaurant')
    .not('website', 'is', null)
    .neq('website', '')
    .limit(200);
  // ⚠️ `industry_key` is stamped by the QUERY that found the row, so a vet clinic answered
  // "restaurants near Vashon" and carried it. Google's own types decide (looksLikeFoodBusiness).
  const base = ((data ?? []) as unknown as (RestaurantRow & { categories: string[] | null })[])
    .filter((r) => (r.business_name ?? '').trim() && looksLikeFoodBusiness(r.categories));
  const templateIds = base.map((r) => r.template_id).filter((id): id is string => !!id);
  const slugById = new Map<string, string>();
  if (templateIds.length) {
    const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug').in('id', templateIds);
    for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null }>) if (t.slug) slugById.set(t.id, t.slug);
  }
  const rows = base.map((r) => ({ ...r, slug: r.template_id ? slugById.get(r.template_id) ?? null : null }));
  const checkedOn = rows.reduce<string | null>((m, r) => (r.ordering_checked_at && (!m || r.ordering_checked_at > m) ? r.ordering_checked_at : m), null);
  return { rows, checkedOn };
}

function hostOf(url: string | null): string {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return url ?? '';
  }
}

function tradeLabel(key: string | null): string {
  if (!key) return 'Other';
  return (KEY_TO_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

/** "17601 Vashon Hwy SW, Vashon, WA 98070, USA" → "17601 Vashon Hwy SW" */
function street(address: string | null): string {
  const first = (address ?? '').split(',')[0]?.trim() ?? '';
  return /vashon, wa/i.test(first) || !first ? '' : first;
}

/** The vanity code's plan (referral_codes.plan.rate). Minted 2026-10-08 on the same terms as angela/ryan. */
const CODE = 'abdou';
const CODE_RATE = 0.35;

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const codePct = Math.round(CODE_RATE * 100);
const closerPct = Math.round(SPLIT.closer * 100);

/** Worked examples — every figure derived here, never typed. */
const EX_ORDERS = 3000; // a busy island cafe's monthly online orders
const EX_FEE = 0.05; // a typical platform fee (cap is MAX_PLATFORM_FEE_PERCENT)
const exFee = EX_ORDERS * EX_FEE;
const exYours = exFee * CODE_RATE;
const RENT = 99; // /for-sales: the rental price today; steps to $399 on page one
const rentYours = RENT * SPLIT.closer;

export const metadata: Metadata = {
  title: 'QuickSites — for Abdou',
  description: 'Island work, on the island — for Abdou.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

function More({ label = 'How it actually works', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        {label}
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm leading-relaxed text-zinc-400">
      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">Example</span>
      {children}
    </div>
  );
}

function Card({
  title,
  tag,
  tone = 'zinc',
  children,
  more,
}: {
  title: string;
  tag?: string;
  tone?: 'zinc' | 'emerald' | 'sky' | 'rose';
  children: React.ReactNode;
  more?: React.ReactNode;
}) {
  const tones = {
    zinc: 'border-zinc-800 bg-zinc-900/40',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.05]',
    sky: 'border-sky-500/25 bg-sky-500/[0.04]',
    rose: 'border-rose-500/25 bg-rose-500/[0.04]',
  } as const;
  const tagTones = {
    zinc: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}>{tag}</span>}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More>{more}</More>}
    </div>
  );
}

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default async function ForAbdouPage() {
  const [island, sites, eateries] = await Promise.all([loadIslandNoSite(), loadIslandSites(), loadIslandRestaurants()]);
  // The grant that lets this page build drafts as the code (lib/rep/repActionToken.ts).
  const repToken = mintRepActionToken(CODE);
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;
  const tableRows: TableRow[] = island.rows.map((r) => {
    const slug = r.templates?.slug ?? null;
    const links = slug ? repBuildLinks({ slug, industryKey: r.industry_key, prospectId: r.id, code: CODE, menuHost }) : null;
    return {
      prospectId: r.id,
      businessName: (r.business_name ?? '').trim(),
      trade: tradeLabel(r.industry_key),
      phone: r.phone,
      street: street(r.address),
      rating: r.rating,
      reviewCount: r.review_count,
      previewUrl: links?.previewUrl ?? null,
      claimUrl: links?.claimUrl ?? null,
    };
  });
  const sweptLabel = island.sweptOn
    ? new Date(island.sweptOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
    : null;
  // Live from the sweep rows: a re-check moves a restaurant between groups without a deploy.
  const restaurants = groupRestaurantsByOrdering(eateries.rows);
  const restaurantsReadOn = eateries.checkedOn
    ? new Date(eateries.checkedOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
    : null;
  const toRow = (group: RestaurantTableRow['group']) => (r: (typeof eateries.rows)[number]): RestaurantTableRow => {
    const links = r.slug ? repBuildLinks({ slug: r.slug, industryKey: 'restaurant', prospectId: r.id, code: CODE, menuHost }) : null;
    return {
      prospectId: r.id,
      businessName: (r.business_name ?? '').trim(),
      phone: r.phone,
      websiteHost: hostOf(r.website),
      platformLabel: group === 'siteOnly' || group === 'thirdParty' ? platformLabel(platformFromWebsiteHost(r.website) ?? r.ordering_platform) : group === 'unchecked' ? 'not checked' : platformLabel(r.ordering_platform),
      group,
      rating: r.rating,
      reviewCount: r.review_count,
      previewUrl: links?.previewUrl ?? null,
      claimUrl: links?.claimUrl ?? null,
      evolveUrl: links?.evolveUrl ?? null,
    };
  };
  const restaurantRows: RestaurantTableRow[] = [
    ...restaurants.call.map(toRow('call')),
    ...restaurants.thirdParty.map(toRow('thirdParty')),
    ...restaurants.siteOnly.map(toRow('siteOnly')),
    ...restaurants.unchecked.map(toRow('unchecked')),
    ...restaurants.leaveAlone.map(toRow('leaveAlone')),
  ];
  // A $20 ticket, the same figure /compare/toast tabulates — derived, never typed.
  const toastBreakEven = breakEvenOrders(2000) ?? 0;
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hello */}
        <section className="relative mx-auto max-w-3xl px-6 pb-10 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Abdou 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            I lived on Vashon for a while, so I know the commute you described. Two ferries a day
            is a job on top of a job. This page is one idea for work that stays on the island:{' '}
            <span className="text-zinc-200">
              walk into the businesses along the highway and in town, and help the ones that still
              have no website get one — free for them, paid to you for as long as it works for them.
            </span>
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            No inventory, nothing to buy, no quota, no boss. You listed customer service and
            deliveries among what you do; this is the first one, on foot, for the second.
          </p>
        </section>

        {/* The one-liner */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <h2 className="text-lg font-bold text-white">What QuickSites is, in one breath</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              We give local businesses a real website for free — a restaurant gets an online-ordering
              site, a shop gets a store, a service business gets a page that ranks — and we earn a
              small cut only when they actually take an order through it.{' '}
              <span className="text-zinc-100">
                When you're the reason they signed up, a share of that cut is yours, every month, for
                as long as they keep selling.
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              You never have to sell anything. You point a business at something free that helps
              them, and if it works for them, it works for you too.
            </p>
          </div>
        </section>

        {/* Your code */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Your code is already live</h2>
              <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                {codePct}% of the fee, for life
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Anyone who signs up with the code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-sky-200">{CODE}</code>{' '}
              — or through your link — is tied to you from then on:
            </p>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200">
              www.quicksites.ai/?ref={CODE}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Every paid order that business ever processes credits you {codePct}% of the platform fee
              — automatically, at the moment the payment lands, refunds reversed. Nothing is
              hand-counted. You don't support them; the product does.
            </p>
            <More label="How you get paid">
              <p>
                Your share accrues from the first order whether or not you've set up payouts. When
                you're ready, you connect a Stripe account once (about two minutes, from your partner
                dashboard) and everything accrued transfers to you; after that it transfers as sales
                happen. The dashboard shows referred businesses, per-order commissions, paid and owed.
              </p>
            </More>
          </div>
        </section>

        {/* The island workflow */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The part built for an island
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Vashon has one highway, one town, and a few hundred businesses that mostly know each
            other by first name. Online that shows up as a lot of places with no website at all —
            a Google listing, a Facebook page, a phone number. That gap is the job.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="1. Build them a site before you ever mention it" tag="20 seconds" tone="sky">
              Go to <span className="text-zinc-200">quicksites.ai/rebuild</span>, paste the business's
              current website or their Google listing, and it builds a new site from their own words
              and photos — a preview link you can show them on your phone. No account, no cost.
              You're not asking them to imagine it; you're showing them theirs.
              <More>
                <p>
                  It reads what they already put online (menu, services, photos, hours), writes
                  fresh copy, and drops it in an editor with a <em>Preview</em> button. For a
                  restaurant it becomes an ordering site. If their listing is thin, the draft will be
                  too — start with the places that have photos and a menu up somewhere.
                </p>
                <Example>
                  The taco place by the Thriftway has a Facebook page and nothing else. You build
                  the preview on the ferry, walk in at 2pm when it's quiet, and show the owner their
                  menu on a site with their name on it. "This is yours if you want it, costs nothing;
                  I get a small cut only if people order through it." That's the whole pitch.
                </Example>
              </More>
            </Card>
            <Card title="2. Walk the highway, keep a list" tag="your phone's notes" tone="sky">
              Town, the Center, Burton, the harbor — one line per business: who, what they sell,
              whether you can order from them online. You are the only person doing this on foot;
              nobody from off-island is going to.
            </Card>
            <Card title="3. Show the preview, then leave it alone" tag="no chasing" tone="sky">
              One visit, one preview, your link. If they sign up, you'll see it on your dashboard.
              If they don't, nothing lost — you were never selling. The ones who say yes already
              wanted a better site.
            </Card>
          </div>
        </section>

        {/* Who on the island */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Who on the island this fits
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🍽️ Restaurants, cafes, food trucks</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                The best fit by far: they take orders, and an ordering site is exactly what we
                build. Every place you'd eat at on the island.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🧺 Shops, farm stands, makers</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                Anyone selling a thing — a store page with checkout, free, and a cut only when it
                sells. The Saturday market is a dozen of these in one place.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🔧 Island trades</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                Plumbers, electricians, septic, tree work, landscaping — a different model (below):
                a site named for the island and the trade, rented monthly once it ranks.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🏠 Services people search for</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                House cleaning, caregiving, dog walking, deliveries — including, if you want it,
                a page for what <em>you</em> do. Yours is free the same way theirs is.
              </p>
            </div>
          </div>
        </section>

        {/* The list */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Island businesses with no website{island.rows.length ? ` — ${island.rows.length} of them` : ''}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {sweptLabel ? (
              <>
                Pulled from Google's own listings on {sweptLabel}: every business on Vashon and Maury that
                Google shows with a phone number and no website. Nothing here is a judgement about them —
                it is just the doors.{' '}
              </>
            ) : (
              <>The island hasn't been swept yet; this fills in automatically when it is. </>
            )}
            <span className="text-zinc-200">
              Start with the ones you'd walk past anyway — and press <em>Build their site</em> before you go in,
              so you have something to show.
            </span>
          </p>
          {/* The tables break out of the 3xl reading column on wide screens — six columns do not
              fit in 768px, and a clipped first column read as a broken page (owner, 2026-10-10). */}
          {tableRows.length > 0 && (
            <div className="lg:-mx-32 xl:-mx-56">
              <NoSiteTable rows={tableRows} token={repToken} repName="Abdou" />
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            A listing here means Google shows no website for them today. Check before you walk in — some
            will have a Facebook page or a site Google hasn't linked. Building takes about twenty seconds
            and costs nothing; a built row gives you the link to open, the claim link to copy, and a text
            message ready to send. Every link carries your code.
          </p>
        </section>

        {/* Restaurants: who already takes orders online, and through whom */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Island restaurants — who takes online orders, and who doesn't
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Most island restaurants already have a website. The question that decides the pitch is whether
            they take orders online, and through whom.{' '}
            {restaurantsReadOn ? (
              <>Read from each restaurant's own site, last on {restaurantsReadOn} — the homepage and its order or menu links. A link kept somewhere else would be missed, so "none found" means exactly that. </>
            ) : (
              <>Their sites haven't been read yet; this fills in when they are. </>
            )}
            Check the door before you walk in.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card title="Call first" tag={`${restaurants.call.length + restaurants.thirdParty.length}`} tone="emerald">
              A site, but no online ordering found — or orders only through a delivery app that takes a cut on
              every one. Here the no-monthly fee has nothing to beat. Press <em>Build their ordering page</em>:
              it reads the menu they already published, so you walk in with their dishes, not a guess.
            </Card>
            <Card title="Offer a site, not the ordering" tag={`${restaurants.siteOnly.length}`} tone="sky">
              Their only web presence is a Toast or Square ordering page. Build them a site that links to it —
              you are giving the name a home, not asking them to change how they take orders. Never pitch
              that first.
            </Card>
            <Card title="Leave alone" tag={`${restaurants.leaveAlone.length}`} tone="zinc">
              On Toast or Square with a site of their own. Nothing to offer today. If one asks, the honest
              comparison is at{' '}
              <Link href="/compare/toast" className="text-sky-400 underline underline-offset-4">quicksites.ai/compare/toast</Link>
              {' '}— above about {toastBreakEven} online orders a month Toast costs them less, and it says so.
            </Card>
          </div>
          {restaurantRows.length > 0 && (
            <div className="lg:-mx-32 xl:-mx-56">
              <RestaurantTable rows={restaurantRows} token={repToken} repName="Abdou" />
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            The ordering page is built from their own site and is theirs to claim; the text message says their
            website stays as it is. "Not checked" means nobody has read that site yet, not that it takes no
            orders.{restaurants.unchecked.length ? ` ${restaurants.unchecked.length} still to check.` : ''}
          </p>
        </section>

        {/* The money */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">What it pays</h2>
          <div className="mt-4 space-y-4">
            <Card title="Referrals — a share of every order, for life" tag={`${codePct}% of the fee`} tone="emerald">
              A business you refer pays a platform fee on each online order (capped at {maxFeePct}%).
              {' '}{codePct}% of that fee is yours, on every order, for as long as they sell.
              <More>
                <Example>
                  An island cafe does {money(EX_ORDERS)}/mo in online orders at a{' '}
                  {Math.round(EX_FEE * 100)}% fee. That's {money(exFee)}/mo in fees —{' '}
                  <span className="text-emerald-300">{money(exYours)}/mo to you</span>, every month, for
                  one afternoon's visit. Ten places like it is {money(exYours * 10)}/mo, and it
                  doesn't care which side of the water you're on.
                </Example>
                <p>
                  The size of it tracks how much they sell online, so food businesses pay best. A
                  business that signs up and never takes an order pays nothing — and earns you
                  nothing. That's the honest shape: you earn when they do.
                </p>
              </More>
            </Card>

            <Card title="Rentals — half the rent on a ranking site" tag={`${closerPct}% of net`} tone="emerald">
              For trades we build sites like <span className="text-zinc-200">vashon-plumbing.com</span>{' '}
              that are meant to rank for the island. A plumber rents it for {money(RENT)}/mo;{' '}
              <span className="text-emerald-300">{money(rentYours)}/mo of that is yours</span>, for as
              long as they keep it. When a site reaches page one the rent steps to $399, and your
              half steps with it.
              <More>
                <p>
                  This one is more of a conversation than a text — it's a business paying monthly for
                  something, so they'll have questions. The full brief, including what a call sounds
                  like, is at <Link href="/for-sales" className="text-sky-400 underline underline-offset-4">/for-sales</Link>.
                  {sites.built > 0
                    ? `Start with referrals; the island sites exist now (${sites.built} of them — see Straight talk below), but none ranks yet, and a rental is a conversation worth having once one does.`
                    : 'Start with referrals; come to this once the island sites exist (next section).'}
                </p>
              </More>
            </Card>
          </div>
        </section>

        {/* Straight talk */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Straight talk — what's real and what isn't yet
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            You'd be counting on this, so you get the whole picture, not the brochure.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="The product is real and it works" tag="proven" tone="emerald">
              Real businesses run on it and checkout takes real money — proven with real cards. The
              commission ledger is wired to the payment webhook, so when a referred order is paid the
              referrer's share is written the same second; that part has been proven with simulated
              orders, not yet by a real referred sale (next card).
            </Card>
            <Card title="Nobody has been paid a referral commission yet" tag="0 paid" tone="rose">
              The referral program is new. The mechanism has been tested end to end, but no referred
              business has yet taken a paid order, so the ledger that would pay you has never paid
              anyone. You would be early — which is why the terms are as generous as they are.
            </Card>
            {sites.built > 0 ? (
              <Card
                title={sites.rented > 0 ? `${sites.built} island sites exist; ${sites.rented} rented` : `${sites.built} island sites exist; none has rented yet`}
                tag={`${sites.built} built · ${sites.rented} rented`}
                tone={sites.rented > 0 ? 'emerald' : 'rose'}
              >
                We hold {sites.built} vashon-<em>trade</em>.com sites (plumbing, towing, electrical, septic and
                the rest), {sites.forwarding} of them already forward calls to a real island business, and the
                island has been mapped — that's the no-website table above. {sites.rented > 0 ? null : 'None has rented and none ranks yet; new domains take months to show up in a search, so that lane is unproven on the island. '}
                Referrals are the safer start.
              </Card>
            ) : (
              <Card title="The island sites don't exist yet" tag="0 built" tone="rose">
                As of today we hold no vashon-<em>anything</em>.com domain. Off-island, sites like these
                hold real search positions but none has rented, so that lane is unproven. Referrals are
                the safer start.
              </Card>
            )}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            What that means in practice: treat the first few months as{' '}
            <span className="text-zinc-200">finding out how many island businesses say yes</span>, not
            as income you can plan around. If three of them do and one takes orders, you'll see the
            first real dollars — and then you'll know what the island is worth.
          </p>
        </section>

        {/* Start */}
        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Want to try it this week?</p>
            <p className="mt-1 text-sm text-zinc-400">
              Three steps, all from your phone: sign up (your code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-200">{CODE}</code> is
              waiting to be claimed), build one site for a place you like at{' '}
              <span className="text-zinc-200">quicksites.ai/rebuild</span>, and walk it in.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/partners/dashboard"
                className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Claim my code →
              </Link>
              <Link
                href="/rebuild"
                className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Build someone a site
              </Link>
              <Link
                href={`/starter-kit/${CODE}?city=Vashon&region=WA&territory=Vashon%20Island`}
                className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Print your starter kit
              </Link>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              The starter kit is business cards, a leave-behind flyer, and a page for each island site that's
              already built — all carrying your code. Add your phone on that page before you print.
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Or just call or text me and I'll walk you through the first one. It's genuinely a
              ten-minute thing, and you're the one who can actually walk in the door.
            </p>
            <p className="mt-3 text-sm font-medium text-emerald-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
