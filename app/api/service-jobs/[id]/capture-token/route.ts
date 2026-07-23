// app/api/service-jobs/[id]/capture-token/route.ts
// Mint (rotate) the per-job glasses capture token (owner-gated). The tech's glasses
// session binds to this token to attach captures to the job.
//   POST -> { ttl_minutes? } -> { capture_token, expires_at }

import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { getJobDetail, mintCaptureToken } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const job = await getJobDetail(id);
  if (!job || job.owner_id !== gate.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let ttl = 12 * 60;
  try {
    const body = await req.json();
    if (body && Number.isFinite(Number(body.ttl_minutes))) ttl = Math.min(24 * 60, Math.max(5, Number(body.ttl_minutes)));
  } catch {
    /* default ttl */
  }

  try {
    const res = await mintCaptureToken(id, ttl);
    // A per-job bind QR: the tech scans it on the glasses (HJ /api/glasses/bind/scan decodes
    // it) → the session binds to this job → captures carry context.{capture_token,job_id,shop_id}.
    const payload = JSON.stringify({ capture_token: res?.capture_token, job_id: id, shop_id: job.owner_id });
    const qr_data_url = res ? await QRCode.toDataURL(payload, { width: 320, margin: 1, errorCorrectionLevel: 'M' }) : null;
    return NextResponse.json({ ok: true, ...res, qr_data_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'mint_failed' }, { status: 500 });
  }
}
