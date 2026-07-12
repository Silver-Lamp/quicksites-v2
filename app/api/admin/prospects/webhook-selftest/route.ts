// app/api/admin/prospects/webhook-selftest/route.ts
//
// Fire a synthetic (but correctly SIGNED) Lob delivery event at our own webhook, so you can
// validate the full webhook path — signature verification + postcard_mailings status
// advancement — without opening the Lob dashboard. Signs with LOB_WEBHOOK_SECRET exactly as
// Lob does, POSTs to /api/outreach/webhooks/lob, then reports the row's status before/after.
// Admin-gated. Body: { lobId?: string, event?: string }  (defaults: latest mailing, delivered)

import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { lobWebhookSecret } from '@/lib/outreach/mail/lob';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function statusFor(lobId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('postcard_mailings')
    .select('status')
    .eq('lob_id', lobId)
    .maybeSingle();
  return (data as any)?.status ?? null;
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok — use defaults */
  }
  const event = String(body?.event || 'postcard.delivered');

  // Target the given piece, or the most recent mailing (i.e. the test card you just sent).
  let lobId = body?.lobId ? String(body.lobId) : '';
  if (!lobId) {
    const { data } = await supabaseAdmin
      .from('postcard_mailings')
      .select('lob_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lobId = (data as any)?.lob_id ?? '';
  }
  if (!lobId) {
    return NextResponse.json({ error: 'No postcard mailings found — send a test card first.' }, { status: 400 });
  }

  const statusBefore = await statusFor(lobId);

  // Build + sign the Lob envelope exactly as verifyLobSignature expects.
  const payload = {
    event_type: { id: event },
    body: { id: lobId, expected_delivery_date: null },
    date_created: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const secret = lobWebhookSecret();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['Lob-Signature'] = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    headers['Lob-Signature-Timestamp'] = timestamp;
  }

  const webhookUrl = `${new URL(req.url).origin}/api/outreach/webhooks/lob`;
  let webhookStatus = 0;
  let webhookText = '';
  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers, body: rawBody });
    webhookStatus = res.status;
    webhookText = await res.text();
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach the webhook: ${e?.message || e}` }, { status: 502 });
  }

  const statusAfter = await statusFor(lobId);

  return NextResponse.json({
    ok: webhookStatus === 200,
    signed: !!secret,
    lobId,
    event,
    webhook: { status: webhookStatus, body: webhookText.slice(0, 200) },
    mailing: { statusBefore, statusAfter, advanced: statusBefore !== statusAfter },
    note: secret
      ? undefined
      : 'LOB_WEBHOOK_SECRET is not set — sent unsigned (prod will 503; dev allows it).',
  });
}
