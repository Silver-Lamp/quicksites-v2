// app/api/service-jobs/[id]/line-items/route.ts
// Set a job's proposed line items (owner-gated) → moves the job to awaiting_approval.
//   PUT -> { items: [{ description, price_cents }] } -> { job }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { getJobDetail, setLineItems } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const job = await getJobDetail(id);
  if (!job || job.owner_id !== gate.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const items = Array.isArray(body.items)
    ? body.items
        .filter((it: any) => it && typeof it.description === 'string')
        .map((it: any) => ({ description: it.description.trim(), price_cents: Number(it.price_cents) || 0 }))
    : [];

  try {
    await setLineItems(id, items);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, job: await getJobDetail(id) });
}
