// app/best-website-builders-2026/page.tsx
//
// The roundup page targeting the query people actually type when shopping for a builder
// ("best website builder 2026"), rather than the comparison query /compare already owns.
// Pattern borrowed from HiveJournal's /best-journaling-apps-2026 — reimplemented, not
// shared, same as the compare cluster itself.
//
// The rule that makes it work: **every competitor genuinely wins its category.** Wix really
// does have the biggest template library; Shopify really is the right answer above a
// certain order volume. A roundup where the author's product wins everything is worthless
// to a reader and transparent to Google. Our own entry is last, explicitly labeled ours,
// and states its gaps — the disclosure is the credibility play, not a legal chore.
//
// Facts come from lib/compare/competitors.ts (the same data behind /compare and
// /compare/<slug>), so pricing and positioning can't drift between the two surfaces —
// update a competitor there and it updates here.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import { marketingOg } from '@/lib/marketingOg';
import { COMPETITORS, PRICES_VERIFIED, competitorBySlug } from '@/lib/compare/competitors';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);

export const metadata = marketingOg({
  title: 'Best Website Builders of 2026 — honest picks by category (including ours)',
  description:
    'The best website builders in 2026, by what you actually need: best templates, best design, best online store, best for designers, best for agencies and resellers. One pick is ours and clearly labeled, with its gaps stated.',
  path: '/best-website-builders-2026',
  ogEyebrow: 'Guide · 2026',
  ogTitle: 'The best website builders of 2026',
  ogSubtitle: 'By what you actually need — and one of them is ours, clearly labeled.',
});

type Pick = {
  category: string;
  name: string;
  price: string;
  blurb: string;
  href: string;
  external?: boolean;
  ours?: boolean;
};

/** Pull pricing straight from the compare data so the two surfaces can't disagree. */
const price = (slug: string) => competitorBySlug(slug)?.pricing ?? '';

const PICKS: Pick[] = [
  {
    category: 'Best all-rounder',
    name: 'Wix',
    price: price('wix'),
    blurb:
      'The widest template gallery and the largest third-party app market of any builder, on top of a genuinely capable editor. If you want the most options and the most tutorials, this is still the default answer. You pay monthly per site, and hosting is never free the way ours is.',
    href: '/compare/wix',
  },
  {
    category: 'Best design out of the box',
    name: 'Squarespace',
    price: price('squarespace'),
    blurb:
      'Nothing else makes an average site look this good with this little effort — the templates are opinionated in a way that protects you from yourself. Less flexible than Wix once you fight the grid, and there is no permanent free plan, only a trial.',
    href: '/compare/squarespace',
  },
  {
    category: 'Best for selling physical products at volume',
    name: 'Shopify',
    price: price('shopify'),
    blurb:
      'If commerce is the business rather than a feature of it — real inventory, multi-channel, shipping, a serious app ecosystem — this is the right tool and it is not close. Overkill (and overpriced) for a local services site that takes a few orders a week.',
    href: '/compare/shopify',
  },
  {
    category: 'Best for designers who want real control',
    name: 'Webflow',
    price: price('webflow'),
    blurb:
      'Pixel-level control with clean, production-grade output and a proper CMS — the closest thing to hand-built without hand-building. The learning curve is genuinely steep; this is a tool for people who already think in the box model.',
    href: '/compare/webflow',
  },
  {
    category: 'Best established agency white-label',
    name: 'Duda',
    price: price('duda'),
    blurb:
      'Built for agencies from the start: client roles, bulk site management, and a mature white-label story. The one to beat if you run an agency today. You still resell a subscription, though — the upside is a markup, not a share of what your clients sell.',
    href: '/compare/duda',
  },
  {
    category: 'Best all-in-one agency CRM + funnels',
    name: 'GoHighLevel',
    price: price('gohighlevel'),
    blurb:
      'The marketing stack, not the website — pipelines, funnels, SMS, email, automations, rebrandable at the top tier. Agencies pick it for the CRM and tolerate the site builder. If marketing automation is the product you sell, start here.',
    href: '/compare/gohighlevel',
  },
  {
    category: 'Best cheap bundle with a domain',
    name: 'GoDaddy',
    price: price('godaddy'),
    blurb:
      'Domain, hosting, email and a site in one bill, at the lowest sticker price on this list. It is the least ambitious builder here, and promo pricing renews higher — but for a one-page presence you never touch again, it is hard to argue with.',
    href: '/compare/godaddy',
  },
  {
    category: 'Best for agencies and resellers who want to earn on client sales',
    name: 'QuickSites',
    price: `Free hosting on every plan · platform fee up to ${maxFeePct}% of orders · resellers keep ${keepPct}% of it, ongoing`,
    blurb:
      'Ours — so weigh this entry accordingly. The structural difference is the business model, not the editor: hosting is free and we monetize a share of commerce, so a reseller earns a lifetime residual on what their clients actually sell instead of a markup on a subscription. Also here: AI that rebuilds an existing site from a URL, industry-specific blocks (menu ordering, trade estimators, listing cards, owner-voice audio), and print-on-demand built in. Honest gaps: a smaller template gallery than Wix or Squarespace, no third-party app marketplace, and if you need enterprise-scale inventory and multi-channel shipping, Shopify is a better fit than we are.',
    href: '/compare',
    ours: true,
  },
];

const HOW_WE_PICKED = [
  'Every product here wins a category on merit — we did not invent categories so that ours would win one.',
  'Pricing is each vendor’s public pricing, checked as of the date below, with sources on each comparison page.',
  'Our own entry is last, labeled, and lists what we are worse at. If that section were empty you should not trust the rest.',
];

export default function BestWebsiteBuilders2026Page() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">
            Guide · 2026
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">
            The best website builders of 2026, by what you actually need.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Most “best builder” lists rank the tool that pays the most affiliate commission. This one
            sorts by the job you’re hiring a builder to do — and the honest answer is that for most
            of these jobs, the right pick isn’t us.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            One entry below is our own product. It’s labeled, it’s last, and it lists what we’re
            worse at.
          </p>
        </section>

        {/* Picks */}
        <section className="mx-auto max-w-4xl px-5 pb-8 sm:px-8">
          <ul className="space-y-4">
            {PICKS.map((p) => (
              <li
                key={p.name}
                className={[
                  'rounded-2xl border p-5 transition sm:p-6',
                  p.ours
                    ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">
                    {p.category}
                  </span>
                  {p.ours ? (
                    <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      This one’s ours
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-2 text-xl font-bold sm:text-2xl">{p.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{p.price}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{p.blurb}</p>

                <Link
                  href={p.href}
                  className="mt-4 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                  {p.ours ? 'See the full comparison →' : `How QuickSites compares to ${p.name} →`}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How we picked — the part that makes the list worth reading */}
        <section className="mx-auto max-w-4xl px-5 pb-10 sm:px-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
            <h2 className="text-lg font-bold">How we picked</h2>
            <ul className="mt-3 space-y-2">
              {HOW_WE_PICKED.map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-zinc-300">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              Pricing verified {PRICES_VERIFIED}. Plans change often — each{' '}
              <Link href="/compare" className="text-zinc-400 underline hover:text-zinc-300">
                comparison page
              </Link>{' '}
              carries the vendor’s own pricing link so you can check us.
            </p>
          </div>
        </section>

        {/* Every competitor, for the reader who wants the head-to-head */}
        <section className="mx-auto max-w-4xl px-5 pb-14 sm:px-8">
          <h2 className="text-lg font-bold">Compare us head-to-head</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMPETITORS.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-500/40 hover:bg-zinc-900/70 hover:text-white"
              >
                vs {c.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
