// app/api/service-jobs/sync/route.ts
// Pull this shop's new glasses captures from HJ's rail into their jobs (owner-gated).
//   POST -> { ok, result: { pulled, stored, acked, skipped? } }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { syncOwnerCaptures } from '@/lib/serviceJobs/captureRail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const result = await syncOwnerCaptures(gate.user.id);
  return NextResponse.json({ ok: true, result });
}
