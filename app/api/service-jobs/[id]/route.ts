// app/api/service-jobs/[id]/route.ts — a single job's full detail (owner-gated).
//   GET -> { job: ServiceJobDetail }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { getJobDetail } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const job = await getJobDetail(id);
  if (!job || job.owner_id !== gate.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
