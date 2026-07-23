// app/jobs/[token]/page.tsx
//
// SecondSet customer portal (docs/SECONDSET_GLASSES_PLAN.md): the customer opens their
// job via an unguessable public_token, SEES the glasses-captured proof (photo of the
// actual problem + the tech's spoken note) and HEARS/reads the explanation, then approves
// or declines the proposed work before it proceeds. The trust loop. noindex.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getJobByPublicToken, getJobDetail } from '@/lib/serviceJobs/serviceJobs';
import JobPortalClient from '@/components/service-jobs/job-portal-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your service job', robots: { index: false, follow: false } };

export default async function JobPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!SECONDSET_ENABLED) notFound();

  const job = await getJobByPublicToken(token);
  if (!job) notFound();
  const detail = await getJobDetail(job.id);
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Service transparency</p>
      <h1 className="mt-1 text-2xl font-semibold">{detail.title || 'Your service job'}</h1>
      {detail.vehicle_ref ? <p className="mt-0.5 text-sm text-muted-foreground">{detail.vehicle_ref}</p> : null}
      <JobPortalClient token={token} initialJob={detail} />
    </main>
  );
}
