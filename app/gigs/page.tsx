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
      <div className="mb-2 text-sm font-medium text-sky-600 dark:text-sky-400">🧺 Store-walk gigs</div>
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
