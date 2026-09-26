// app/compare/[slug]/page.tsx
//
// One SEO page per competitor — "QuickSites vs <Name>" AND "<Name> alternative" — generated from
// lib/compare/competitors.ts. These are the exact-match comparison-shopper pages the /compare hub
// links into.
//
// ⚠️ THIS COMMENT USED TO BE FALSE, WHICH IS WHY THE SECOND PHRASING IS SPELLED OUT NOW. It said
// these pages covered "wix alternative" from the day they shipped. They did not: the word appeared
// in this comment and nowhere a crawler reads — not the title, the H1, the description or the body.
// Search Console settled it on 2026-09-26: across 394 distinct queries, **zero** impressions for
// any `<vendor> alternative`, while `duda vs wix` alone drew 94 (at position ~34, 0 clicks). An
// absence of impressions was the absence of a page, not the absence of demand.
//
// ⚠️ A comment is not a keyword. If you add a phrasing here, add it to the metadata in the same
// edit — `lib/compare/__tests__/alternativePhrasing.test.ts` now fails if they drift apart.
//
// Adding a competitor = one entry in COMPETITORS; this route, the hub, and the sitemap
// all pick it up. Unknown slugs 404 (dynamicParams=false). Honesty-first: every page
// states what the competitor does better, then where the QuickSites model wins.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import { CompareTable } from '@/components/compare/compare-table';
import { CaseStudyVendorCallout } from '@/components/compare/case-study-callout';
import { marketingOg } from '@/lib/marketingOg';
import {
  COMPETITORS,
  COMPETITOR_SLUGS,
  competitorBySlug,
  pricesVerifiedFor,
} from '@/lib/compare/competitors';

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map((slug) => ({ slug }));
}

// Only the real competitor slugs render; anything else 404s instead of an empty shell.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) return {};
  return marketingOg({
    // ⚠️ BOTH PHRASINGS, ONE PAGE — and the "alternative" half was missing until 2026-09-26.
    //
    // This file's own header comment claimed these pages target "wix alternative". They did not:
    // the word appeared nowhere a crawler reads, only in the comment. Search Console agrees —
    // across 394 distinct queries we have **zero** impressions for any `<vendor> alternative`,
    // while `duda vs wix` alone drew 94. That zero was the absence of a page, not of demand.
    //
    // The two phrasings are different INTENT, which is why it is worth carrying both: someone
    // searching "duda vs wix" is choosing between two products that are not us, while someone
    // searching "wix alternative" has already decided to leave. The second is the audience.
    //
    // One page, not a second /alternatives/* route: Google ranks one URL for both, and a parallel
    // cluster would be thin and cannibalise this one.
    title: `${c.name} alternative — QuickSites vs ${c.name}: pricing, features & an honest verdict`,
    description: `Looking for a ${c.name} alternative? ${c.name} (${c.pricing}) vs QuickSites (free hosting + a commerce take-rate). Side-by-side on cost, ecommerce, AI site build, and reseller economics — including what ${c.name} does better.`,
    path: `/compare/${c.slug}`,
    ogEyebrow: 'Compare',
    ogTitle: `QuickSites vs ${c.name}`,
    ogSubtitle: c.oneLiner,
  });
}

function List({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'us' }) {
  const icon = tone === 'us' ? '✓' : '★';
  const iconClass = tone === 'us' ? 'text-emerald-400' : 'text-amber-400';
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-zinc-300">
            <span aria-hidden className={`mt-0.5 shrink-0 ${iconClass}`}>{icon}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function CompareCompetitorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) notFound();

  const others = COMPETITORS.filter((o) => o.slug !== c.slug);

  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-14 pb-8 text-center">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Compare · {c.category}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-5xl">
            QuickSites <span className="text-zinc-500">vs</span> {c.name}
          </h1>
          {/* ⚠️ The "alternative" phrasing as a real sentence, not a keyword stuffed into the H1.
              The H1 stays "QuickSites vs <Name>" because that is what the page IS; this line
              carries the other intent and reads like something a person wrote. Someone who
              searched "<name> alternative" has already decided to leave — meet them there rather
              than opening with a comparison they did not ask for. */}
          <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-300">
            Looking for a <span className="font-semibold text-white">{c.name} alternative</span>?
            Here is the honest version — including what {c.name} does better.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">{c.oneLiner}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-200">The short version:</span> {c.name} is a strong{' '}
            {c.category}. The difference is the business model — QuickSites hosts free and monetizes commerce
            with a take-rate + a lifetime reseller residual on GMV, so agencies earn as their clients sell.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/rebuild" className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              See your site — free
            </Link>
            <Link href="/compare" className="rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-300 transition hover:bg-zinc-800">
              All comparisons
            </Link>
          </div>
        </section>

        {/* Pricing snapshot */}
        <section className="mx-auto max-w-4xl px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">QuickSites</div>
              <div className="mt-1 text-lg font-bold">Free hosting + a commerce take-rate</div>
              <p className="mt-1 text-sm text-zinc-400">No per-site subscription. You earn a % of every order, and resellers keep a lifetime residual on GMV.</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.name}</div>
              <div className="mt-1 text-lg font-bold">{c.pricing}</div>
              <p className="mt-1 text-sm text-zinc-400">{c.freeTier}</p>
            </div>
          </div>
        </section>

        {/* Feature matrix */}
        <section className="mx-auto max-w-4xl px-6 py-8">
          <h2 className="mb-4 text-2xl font-semibold">QuickSites vs {c.name}, feature by feature</h2>
          <CompareTable competitor={c} />
        </section>

        {/* Agency economics — only for the vendors the Gemini deck modelled; null otherwise */}
        <CaseStudyVendorCallout slug={c.slug} />

        {/* Honest two-sided verdict */}
        <section className="mx-auto max-w-4xl px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <List title={`What ${c.name} does well`} items={c.strengths} tone="good" />
            <List title="Where the QuickSites model wins" items={c.tradeoffs} tone="us" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <List title={`Pick ${c.name} if…`} items={c.pickThemIf} tone="good" />
            <List title="Pick QuickSites if…" items={c.pickUsIf} tone="us" />
          </div>
        </section>

        {/* Cross-links to the rest of the cluster */}
        <section className="mx-auto max-w-4xl px-6 py-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">More comparisons</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/compare/${o.slug}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
              >
                QuickSites vs {o.name}
              </Link>
            ))}
          </div>
        </section>

        {/* CTA + sources */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <h2 className="text-xl font-semibold">Ready to see your own site?</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-400">
              Paste your current site or start fresh — our AI assembles a clean, mobile-first site in seconds. Free to host.
            </p>
            <Link href="/rebuild" className="mt-4 inline-flex rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              Build my site — free
            </Link>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-600">
            Pricing is {c.name}’s public pricing as of {pricesVerifiedFor(c)} and changes over time — check their site for current details. Sources:{' '}
            {c.sources.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400">{s.label}</a>
                {i < c.sources.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
