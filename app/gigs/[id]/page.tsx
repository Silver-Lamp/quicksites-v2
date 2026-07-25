// app/gigs/[id]/page.tsx
//
// Public per-gig landing page — the link every cross-post points to. Shows the gig (store,
// area, what the task is) and a "Claim this gig" CTA that sends the visitor to sign in and
// land on the tasker board. Net-new: gigs previously lived only in the authed /walker board.
// Open + claimable gigs render; a completed/closed gig shows a gentle "no longer available".
// See docs/AISLEASK_OPS_PLAN.md Feature B #1.
//
// Colors use the semantic theme tokens (not literal zinc/white) — the app wraps pages in a
// dark ThemeScope, so hard-coded light values rendered dark-on-dark. Same fix as /walker.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGig } from '@/lib/walker/gigs';
import { gigWhere, gigLocality } from '@/lib/walker/gigPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const gig = await getGig(id);
  if (!gig) return { title: 'Gig not found', robots: { index: false } };
  const title = `Catalog a store's aisles — ${gigLocality(gig)}`;
  return {
    title,
    description: `Flexible ~20-minute gig at ${gig.store_name}. Walk the aisles, catalog the store, on your own schedule.`,
    // Open gigs are worth indexing (organic recruiting); taken/closed ones are not.
    robots: { index: gig.status === 'open', follow: true },
  };
}

export default async function GigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gig = await getGig(id);
  if (!gig) notFound();

  const where = gigWhere(gig);
  const claimHref = `/login?next=/walker`;
  const available = gig.status === 'open';

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-12 text-foreground">
      <div className="mb-6 text-sm font-medium text-sky-600 dark:text-sky-400">🧺 Store-walk gig</div>
      <h1 className="text-3xl font-bold tracking-tight">Catalog a store&rsquo;s aisles</h1>
      <p className="mt-1 text-muted-foreground">{gigLocality(gig)}</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">The store</dt>
            <dd className="font-semibold text-card-foreground">{gig.store_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Where</dt>
            <dd>{where}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd>About 15&ndash;30 minutes, on your own schedule.</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">What you do</dt>
            <dd>
              Walk the aisles in order and record what&rsquo;s in each section. We make it easy
              &mdash; no special skills needed.
            </dd>
          </div>
        </dl>
      </div>

      {available ? (
        <div className="mt-8">
          <Link
            href={claimHref}
            className="inline-block rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:opacity-90"
          >
            Claim this gig &rarr;
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            You&rsquo;ll sign in, then it&rsquo;s added to your walk &mdash; tap &ldquo;Plan my
            route&rdquo; to catalog several stores in one efficient loop.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          This gig is {gig.status === 'claimed' ? 'already claimed' : 'no longer available'}.{' '}
          <Link href="/gigs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            See other open gigs &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
