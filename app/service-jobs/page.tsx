// app/service-jobs/page.tsx
//
// SecondSet shop console (docs/SECONDSET_GLASSES_PLAN.md): where a shop creates a job,
// mints the per-job glasses capture token for the tech, proposes work, and watches the
// customer's approve/decline come back. Auth is enforced by the /api/service-jobs routes
// (owner-scoped); the client shows a sign-in prompt on 401. Flag-gated + noindex.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import ShopJobsClient from '@/components/service-jobs/shop-jobs-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SecondSet — Service jobs', robots: { index: false, follow: false } };

export default function ServiceJobsPage() {
  if (!SECONDSET_ENABLED) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">SecondSet</p>
      <h1 className="mt-1 text-2xl font-semibold">🎙️ Service jobs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Capture the work on the glasses, show the customer the proof, get approval before you turn a wrench.
      </p>
      <ShopJobsClient />
    </main>
  );
}
