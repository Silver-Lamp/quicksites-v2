// app/api/glasses/job/route.ts
//
// SecondSet job-binding resolution for the glasses companion (crosstalk/contracts/
// glasses-capture.md). The tech binds their glasses session to a per-job capture token;
// the companion calls this to learn the job identity it must put in the capture `context`
// AND whether pre-capture consent is on file — because HJ's rail 400s a `customer`/`per_job`
// capture unless consent.obtained=true. The opaque capture token IS the credential.
//   GET /api/glasses/job?token=<capture_token>
//     -> { ok, job_id, work_order_id, shop_id, title, consent_obtained }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getJobByCaptureToken } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const token = new URL(req.url).searchParams.get('token')?.trim() || '';
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  const job = await getJobByCaptureToken(token);
  if (!job) return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    work_order_id: job.id, // the service job IS the work order
    shop_id: job.owner_id,
    title: job.title,
    consent_obtained: !!job.consent_captured_at,
  });
}
