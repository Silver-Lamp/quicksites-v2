// app/api/service-jobs/route.ts — SecondSet shop-side job list + create (owner-gated).
//   GET  -> { jobs }            (the signed-in shop's jobs)
//   POST -> { title, customer_email?, customer_name?, customer_id?, vehicle_ref? } -> { job }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { createServiceJob, listOwnerJobs } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const jobs = await listOwnerJobs(gate.user.id);
  return NextResponse.json({ ok: true, jobs });
}

export async function POST(req: Request) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'missing_title' }, { status: 400 });

  try {
    const job = await createServiceJob({
      ownerId: gate.user.id,
      title,
      customerId: body.customer_id ?? null,
      customerEmail: typeof body.customer_email === 'string' ? body.customer_email.trim() : null,
      customerName: typeof body.customer_name === 'string' ? body.customer_name.trim() : null,
      vehicleRef: typeof body.vehicle_ref === 'string' ? body.vehicle_ref.trim() : null,
    });
    return NextResponse.json({ ok: true, job });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'create_failed' }, { status: 500 });
  }
}
