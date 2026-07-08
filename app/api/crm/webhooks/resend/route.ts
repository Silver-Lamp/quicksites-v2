// app/api/crm/webhooks/resend/route.ts
//
// Receives Resend delivery webhooks and stamps per-send engagement on
// crm_campaign_sends (opened/clicked/bounced/complained), correlated by the Resend
// email id stored at send time. Signature-verified (Svix HMAC). A complaint also
// flips the customer's marketing_consent off (hard opt-out).
//
// Configure in the Resend dashboard: add a webhook → this URL, copy the signing
// secret into RESEND_WEBHOOK_SECRET. Until that env is set, the route rejects.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyResendSignature, engagementColumnForEvent } from '@/lib/crm/resendWebhook';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  const body = await req.text();
  const ok = verifyResendSignature({
    secret,
    body,
    svixId: req.headers.get('svix-id'),
    svixTimestamp: req.headers.get('svix-timestamp'),
    svixSignature: req.headers.get('svix-signature'),
  });
  if (!ok) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const type = String(event?.type || '');
  const emailId = event?.data?.email_id;
  const atIso = event?.created_at || new Date().toISOString();
  const col = engagementColumnForEvent(type);

  // Only the engagement events matter; ack everything else (delivered/sent/…) as 200.
  if (!col || !emailId) return NextResponse.json({ ok: true, ignored: type || 'unknown' });

  const svc = (await getServerSupabase({ serviceRole: true })) as any;

  // First-touch: only stamp when the column is still null, so repeated opens/clicks
  // keep the earliest timestamp. Return the row so we can act on complaints.
  const { data: rows } = await svc
    .from('crm_campaign_sends')
    .update({ [col]: atIso })
    .eq('provider_message_id', emailId)
    .is(col, null)
    .select('id, campaign_id, customer_id');
  const row = (rows ?? [])[0];

  // A spam complaint is a hard opt-out — flip consent + emit the unsubscribe event.
  if (type === 'email.complained' && row?.customer_id) {
    await svc.from('customers').update({ marketing_consent: false, updated_at: new Date().toISOString() }).eq('id', row.customer_id);
    await captureServer(EVENTS.CUSTOMER_UNSUBSCRIBED, { customer_id: row.customer_id, reason: 'complaint' }, row.customer_id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
