// app/api/commerce/webhooks/lulu/route.ts
//
// Lulu print-job status webhook → update the matching print_orders row.
// Verifies the HMAC signature when LULU_WEBHOOK_SECRET is set.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLuluWebhook, extractWebhookJob } from '@/lib/commerce/pod/lulu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const sig =
    req.headers.get('lulu-hmac-sha256') ??
    req.headers.get('x-lulu-hmac-sha256') ??
    req.headers.get('x-lulu-signature') ??
    undefined;
  if (!verifyLuluWebhook(raw, sig ?? undefined)) {
    return new NextResponse('bad signature', { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return new NextResponse('bad payload', { status: 400 });
  }

  const job = extractWebhookJob(payload);
  if (job) {
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
        auth: { persistSession: false },
      });
      await db
        .from('print_orders')
        .update({ status: job.status, updated_at: new Date().toISOString() })
        .eq('provider', 'lulu')
        .eq('provider_job_id', job.jobId);
    } catch (e: any) {
      console.warn('[lulu webhook] update failed:', e?.message || e);
    }
  }
  return new NextResponse('ok', { status: 200 });
}
