// app/for-sales/practice/page.tsx
// The practice room. Admin-gated in the page as well as the route — every turn spends real money
// on the partner grant, and a page that renders for someone who cannot use it is a worse
// experience than one that says no.
//
// The lane is read server-side so the client never needs the full spec: the browser sends a line
// and an archetype id, and the server assembles the envelope (contract §1c) with the credentials.
import type { Metadata } from 'next';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { GEO_DOMAIN_RENTAL_LANE as LANE } from '@/lib/sales/lanes/geoDomainRental';
import { rehearsalEnabled } from '@/lib/rehearsal/config';
import PracticeClient from './practice-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Practice — QuickSites',
  robots: { index: false, follow: false },
};

export default async function PracticePage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-zinc-400">Forbidden.</div>;

  if (!rehearsalEnabled()) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-zinc-300">
        <h1 className="text-xl font-bold text-white">Practice is not configured</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          The rehearsal engine needs <code className="rounded bg-zinc-800 px-1">HJ_REHEARSAL_GRANT</code>{' '}
          and <code className="rounded bg-zinc-800 px-1">REHEARSAL_PRACTICE_ENABLED</code> in this
          environment. The call sheet at <a className="text-amber-400 underline" href="/for-sales/call">/for-sales/call</a>{' '}
          works without it.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <PracticeClient
        archetypes={LANE.archetypes.map((a) => ({
          id: a.id,
          label: a.label,
          openingState: a.openingState,
        }))}
        objections={LANE.objections.map((o) => ({
          id: o.id,
          says: o.says,
          goodMove: o.goodMove,
        }))}
      />
    </div>
  );
}
