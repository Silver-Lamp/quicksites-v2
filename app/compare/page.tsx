// app/compare/page.tsx
//
// The compare HUB — QuickSites vs the website-builder field. Leads with the structural
// wedge (free hosting + a commerce take-rate + a lifetime reseller residual on GMV), then a
// card per competitor linking into the per-competitor SEO pages at /compare/<slug>.
//
// Data-driven from lib/compare/competitors.ts (add a competitor there → hub card, the
// /compare/<slug> route, and the sitemap all update). Honest by design — every competitor
// page states what they do better, which is what keeps the wedge credible.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { marketingOg } from '@/lib/marketingOg';
import { COMPETITORS, PRICES_VERIFIED } from '@/lib/compare/competitors';
import SiteFooter from '@/components/site/site-footer';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);

export const metadata = marketingOg({
  title: 'QuickSites vs Wix, Squarespace, Shopify, Duda & more — an honest comparison',
  description:
    'How QuickSites compares to the major website builders. We host free and monetize commerce with a take-rate + a lifetime reseller residual on GMV — the model the subscription builders structurally chose not to build.',
  path: '/compare',
  ogEyebrow: 'Compare',
  ogTitle: 'How QuickSites compares',
  ogSubtitle: 'Free hosting + a commerce take-rate + a lifetime reseller residual — the model they didn’t build.',
});

const WEDGE = [
  { title: 'Free hosting', body: 'No per-site subscription to keep a site live — every plan hosts free.' },
  { title: 'You earn on every sale', body: `A commerce take-rate up to ${maxFeePct}% via Stripe Connect that scales with the merchant’s GMV.` },
  { title: 'Lifetime reseller residual', body: `Resellers keep ${keepPct}% of every order fee — ongoing, not a one-time markup.` },
];

export default function CompareHubPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-14 pb-8 text-center">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Compare
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-5xl">How QuickSites compares</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            The other builders sell you a monthly subscription. QuickSites hosts free and earns alongside
            you — a commerce take-rate plus a lifetime reseller residual on GMV. Here’s the honest
            side-by-side, competitor by competitor.
          </p>
        </section>

        {/* The structural wedge */}
        <section className="mx-auto max-w-5xl px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {WEDGE.map((w) => (
              <div key={w.title} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 text-left">
                <h2 className="text-base font-semibold text-emerald-300">{w.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Per-competitor cards → the SEO pages */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-2xl font-semibold">Pick a comparison</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITORS.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-left transition hover:border-emerald-500/40 hover:bg-zinc-900/70"
              >
                <h3 className="text-lg font-bold text-white">QuickSites vs {c.name}</h3>
                <div className="mt-0.5 text-xs uppercase tracking-wide text-zinc-500">{c.category}</div>
                <p className="mt-2 flex-1 text-sm text-zinc-400">{c.oneLiner}</p>
                <div className="mt-3 text-xs text-zinc-500">Their pricing: {c.pricing}</div>
                <span className="mt-3 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300">
                  See the comparison →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Honest note + CTA */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <h2 className="text-xl font-semibold">Every one of these is a real, capable product.</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-400">
              We say plainly what each does better — the wedge isn’t that they’re bad, it’s that they
              structurally chose not to let you earn on your clients’ sales. See your own site in seconds.
            </p>
            <Link href="/rebuild" className="mt-4 inline-flex rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              Build my site — free
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-600">
            Competitor pricing is public pricing as of {PRICES_VERIFIED} and changes over time — each comparison links its sources.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
