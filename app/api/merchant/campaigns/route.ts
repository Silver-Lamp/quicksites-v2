// app/api/merchant/campaigns/route.ts
//
// POST — create/send a customer email campaign (CRM Phase 3). Owner-gated. Three
// actions:
//   preview → resolve the segment to a recipient count (no send)
//   test    → send one email to the signed-in merchant's own address
//   send    → create the campaign, blast the consented audience, log each send
// crm_campaigns is deny-default RLS, so all writes go through the service role.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireMerchantOwner } from '@/lib/auth/requireUser';
import { orgEmailBrand, sendEmail } from '@/lib/email';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { isSegment, type Segment } from '@/lib/crm/segments';
import {
  resolveAudience,
  sendToRecipients,
  renderCampaignHtml,
  MAX_SYNC_RECIPIENTS,
} from '@/lib/crm/campaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // email sends are network-bound

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    merchantId?: string;
    action?: 'preview' | 'test' | 'send';
    subject?: string;
    body?: string;
    segment?: { seg?: string; tag?: string | null };
  };

  const merchantId = String(body.merchantId || '');
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  const gate = await requireMerchantOwner(merchantId);
  if (gate instanceof NextResponse) return gate;

  const seg: Segment = isSegment(body.segment?.seg) ? (body.segment!.seg as Segment) : 'all';
  const tag = body.segment?.tag?.trim() || null;
  const action = body.action || 'preview';
  // Cast: crm_campaigns/customers aren't in the generated types (CLAUDE.md §8).
  const svc = (await getServerSupabase({ serviceRole: true })) as any;

  // ---- preview: just the count ----
  if (action === 'preview') {
    const audience = await resolveAudience(svc, merchantId, { seg, tag });
    return NextResponse.json({
      recipientCount: audience.length,
      cap: MAX_SYNC_RECIPIENTS,
      overCap: audience.length > MAX_SYNC_RECIPIENTS,
    });
  }

  const subject = String(body.subject || '').trim();
  const text = String(body.body || '').trim();
  if (!subject || !text) return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });

  // ---- test: one email to the merchant's own address ----
  if (action === 'test') {
    const to = gate.user.email;
    if (!to) return NextResponse.json({ error: 'Your account has no email to test to' }, { status: 400 });
    const brand = await orgEmailBrand();
    const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://quicksites.ai').replace(/\/+$/, '');
    const html = renderCampaignHtml({ body: text, unsubscribeUrl: base, footer: brand.footer });
    const res = await sendEmail({ to, subject: `[Test] ${subject}`, html, from: brand.from });
    if ((res as any)?.ok === false) return NextResponse.json({ error: 'Test send failed' }, { status: 502 });
    return NextResponse.json({ ok: true, testTo: to });
  }

  // ---- send: real blast to the consented audience ----
  const audience = await resolveAudience(svc, merchantId, { seg, tag });
  if (audience.length === 0) {
    return NextResponse.json({ error: 'No opted-in recipients match this segment.' }, { status: 400 });
  }
  if (audience.length > MAX_SYNC_RECIPIENTS) {
    return NextResponse.json(
      { error: `${audience.length} recipients exceeds the ${MAX_SYNC_RECIPIENTS} per-send cap. Narrow the segment.` },
      { status: 400 },
    );
  }

  const { data: campaign, error: cErr } = await svc
    .from('crm_campaigns')
    .insert({
      merchant_id: merchantId,
      channel: 'email',
      subject,
      body: text,
      segment: { seg, tag },
      status: 'sending',
      recipient_count: audience.length,
      created_by: gate.user.id,
    })
    .select('id')
    .single();
  if (cErr || !campaign) return NextResponse.json({ error: cErr?.message || 'Could not create campaign' }, { status: 400 });

  const { sent, failed } = await sendToRecipients(svc, { campaignId: campaign.id, subject, body: text, recipients: audience });

  await svc
    .from('crm_campaigns')
    .update({ status: failed && !sent ? 'failed' : 'sent', sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() })
    .eq('id', campaign.id);

  await captureServer(
    EVENTS.CAMPAIGN_SENT,
    { merchant_id: merchantId, campaign_id: campaign.id, recipients: audience.length, sent, failed, segment: seg, tag },
    merchantId,
  ).catch(() => {});

  return NextResponse.json({ ok: true, campaignId: campaign.id, sent, failed });
}
