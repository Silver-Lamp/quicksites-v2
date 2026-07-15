// app/api/admin/prospects/text-prospects/route.ts
//
// Text the claim link to every competing business in a geo-industry campaign.
// GATED behind PROSPECT_SMS_ENABLED — cold B2B SMS needs A2P 10DLC + consent handling
// (see lib/outreach/sms/outreachSms.ts). Marks each prospect sms_sent_at.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign, markOutreachSent } from '@/lib/outreach/prospects';
import { sendOutreachSms, prospectSmsEnabled, type SmsSender } from '@/lib/outreach/sms/outreachSms';
import { outreachReadinessGateEnabled } from '@/lib/flags/outreachReadinessGate';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
import { getSenderProfile } from '@/lib/outreach/senderProfile';

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

  // Refine-before-outreach gate (flag-gated).
  if (outreachReadinessGateEnabled() && !campaign.outreach_ready_at) {
    return NextResponse.json(
      { error: 'This site isn’t marked ready for outreach. Refine it and mark it ready first.', code: 'not_ready' },
      { status: 409 },
    );
  }

  const prospects = await listProspectsByCampaign(campaignId);

  // Resolve who signs the text once — a branded campaign uses the org's identity, the default
  // brand uses the operator's sender profile. Mirrors the postcard sign-off across channels.
  const brand = await resolveCampaignBrand(campaign.org_id);
  let sender: SmsSender | null;
  if (campaign.org_id && brand.orgId) {
    sender = { name: brand.name, email: brand.supportEmail };
  } else {
    const profile = await getSenderProfile();
    sender = { name: profile.name, email: profile.email };
  }

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
      campaignId: campaign.id,
      sender,
    });
    if (r.ok) sentIds.push(p.id);
    results.push({ prospectId: p.id, ok: r.ok, error: r.error });
  }
  if (sentIds.length) await markOutreachSent(sentIds, 'sms');

  return NextResponse.json({ ok: true, sent: sentIds.length, results });
}
