// app/gigs/page.tsx
//
// Public "open gigs" index — an indexable list of every open cataloging gig. This is the
// legitimately-automatable recruiting channel: free organic/SEO reach, always current, no
// ToS gymnastics (unlike Marketplace/Craigslist). Each row links to /gigs/[id]. See
// docs/AISLEASK_OPS_PLAN.md Feature B #5.
//
// Colors use the semantic theme tokens (not literal zinc/white) — the app wraps pages in a
// dark ThemeScope, so hard-coded light values rendered dark-on-dark. Same fix as /walker.

import Link from 'next/link';
import type { Metadata } from 'next';
import { listOpenGigs } from '@/lib/walker/gigs';
import { gigLocality, gigWhere } from '@/lib/walker/gigPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Store-walk gigs — flexible ~20-minute local gigs',
  description:
    'Claim a flexible store-walk gig near you: walk a store’s aisles and catalog it in about 20 minutes, on your own schedule.',
  robots: { index: true, follow: true },
};

export default async function GigsIndexPage() {
  const gigs = await listOpenGigs(200);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12 text-foreground">
      <div className="mb-2 text-sm font-medium text-sky-600 dark:text-sky-400">
        🧺 Store-walk gigs
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Flexible local gigs, ~20 minutes each</h1>
      <p className="mt-2 text-muted-foreground">
        Walk a store&rsquo;s aisles and catalog it &mdash; on your own schedule. Claim one to get
        started.
      </p>

      {gigs.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No open gigs right now. Check back soon.</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {gigs.map((g) => (
            <li key={g.id}>
              <Link
                href={`/gigs/${g.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-sky-500/60 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-card-foreground">{g.store_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{gigWhere(g)}</div>
                </div>
                <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400">
                  {gigLocality(g)} &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* ── How it works ──────────────────────────────────────────────────────────────
          Added after FIVE independent persona testers reported the same gap: the page said
          "Claim one to get started" and never explained what the task is, how to apply, or
          how payment works. One finding is a hypothesis; five converging is a pattern, and
          this one checked out — there was no explanation anywhere on the page. */}
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1. Claim a gig above.</span> You&rsquo;ll
            sign in, and it&rsquo;s added to your walk board.
          </li>
          <li>
            <span className="font-medium text-foreground">2. Walk the store.</span> Go up and down
            the aisles and note what&rsquo;s on the shelves &mdash; roughly 20 minutes for a typical
            store. Nothing to install and nobody to check in with; you don&rsquo;t need to speak to
            staff.
          </li>
          <li>
            <span className="font-medium text-foreground">3. Submit and you&rsquo;re done.</span>{' '}
            Your walk board keeps the list, so you can stop and pick it up later.
          </li>
        </ol>

        {/* ⚠️ HONESTY: lib/walker/gigs.ts is explicit that v0 has NO payments, and catalog_gigs
            has no pay column. "Flexible local gigs" reads as paid work to anyone who hasn't
            read the source, so the page has to say plainly that it isn't — before someone
            spends twenty minutes in a supermarket expecting to be paid. The compensation model
            is an open decision; until it's made, this states what is actually true today. */}
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-sm font-medium text-foreground">
            About pay &mdash; please read before you claim
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            These gigs are <span className="font-medium text-foreground">not paid yet</span>. This
            is an early pilot and we&rsquo;d rather say so than let &ldquo;gig&rdquo; imply a
            paycheck. Claim one if you&rsquo;re curious about the project or happy to help it get
            off the ground &mdash; not because you&rsquo;re expecting to earn from it today.
          </p>
        </div>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Already signed in? Go to your{' '}
        <Link href="/walker" className="text-sky-600 hover:underline dark:text-sky-400">
          walk board
        </Link>
        .
      </p>
    </div>
  );
}
