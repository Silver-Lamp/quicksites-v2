// app/api/admin/prospects/text-prospects/route.ts
//
// Text the claim link to every competing business in a geo-industry campaign.
// GATED behind PROSPECT_SMS_ENABLED — cold B2B SMS needs A2P 10DLC + consent handling
// (see lib/outreach/sms/outreachSms.ts). Marks each prospect sms_sent_at.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign, markOutreachSent } from '@/lib/outreach/prospects';
import { sendOutreachSms, prospectSmsEnabled } from '@/lib/outreach/sms/outreachSms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TEXTS = 25;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!prospectSmsEnabled()) {
    return NextResponse.json(
      { error: 'Prospect SMS is disabled. Set PROSPECT_SMS_ENABLED=1 (after A2P 10DLC registration).', code: 'disabled' },
      { status: 403 },
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  if (!campaign.template_id) return NextResponse.json({ error: 'Campaign has no pitch site.' }, { status: 400 });

  const prospects = await listProspectsByCampaign(campaignId);

  const results: Array<Record<string, unknown>> = [];
  const sentIds: string[] = [];
  for (const p of prospects.slice(0, MAX_TEXTS)) {
    if (!p.phone) {
      results.push({ prospectId: p.id, ok: false, error: 'no_phone' });
      continue;
    }
    const r = await sendOutreachSms({
      phone: p.phone,
      businessName: p.business_name,
      domain: campaign.domain,
      templateId: campaign.template_id,
    });
    if (r.ok) sentIds.push(p.id);
    results.push({ prospectId: p.id, ok: r.ok, error: r.error });
  }
  if (sentIds.length) await markOutreachSent(sentIds, 'sms');

  return NextResponse.json({ ok: true, sent: sentIds.length, results });
}
