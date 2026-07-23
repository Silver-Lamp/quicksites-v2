// app/api/service-jobs/portal/[token]/decision/route.ts
// Customer approves/declines proposed line items from the portal (public via the job's
// public_token — the unguessable token is the credential). Optionally records the
// on-site-capture consent. Rolls decisions up into the job status.
//   POST -> { decisions: [{ lineItemId, approved }], consent?: true } -> { job }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import {
  getJobByPublicToken,
  applyCustomerDecision,
  recordConsent,
} from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const { token } = await params;

  const job = await getJobByPublicToken(token);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (body.consent === true && !job.consent_captured_at) {
    await recordConsent(job.id);
  }

  const decisions = Array.isArray(body.decisions)
    ? body.decisions
        .filter((d: any) => d && typeof d.lineItemId === 'string')
        .map((d: any) => ({ lineItemId: d.lineItemId, approved: !!d.approved }))
    : [];

  try {
    const detail = await applyCustomerDecision(job.id, decisions);
    return NextResponse.json({ ok: true, job: detail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'decision_failed' }, { status: 500 });
  }
}
