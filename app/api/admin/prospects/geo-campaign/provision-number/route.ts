// app/api/admin/prospects/geo-campaign/provision-number/route.ts
//
// Provision a Twilio tracking number for a geo-domain campaign — a number that forwards
// to the business and logs every call, so we can prove lead volume (the rental model's
// proof/retention engine — see docs/GEO_DOMAIN_MONETIZATION.md).
//
// GATED behind CALL_TRACKING_ENABLED + Twilio creds because buying a number costs money.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, setCampaignTracking } from '@/lib/outreach/geoCampaigns';
import {
  callTrackingEnabled,
  twilioConfigured,
  provisionTrackingNumber,
  areaCodeFromPhone,
} from '@/lib/outreach/callTracking';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!twilioConfigured()) {
    return NextResponse.json({ error: 'Twilio is not configured.', code: 'not_configured' }, { status: 501 });
  }
  if (!callTrackingEnabled()) {
    return NextResponse.json(
      { error: 'Call tracking is disabled. Set CALL_TRACKING_ENABLED=1 to buy tracking numbers.', code: 'disabled' },
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
  if (campaign.tracking_number) {
    return NextResponse.json({ ok: true, number: campaign.tracking_number, alreadyProvisioned: true });
  }

  // Where calls forward: explicit body → existing → a platform fallback capture line.
  const forwardTo =
    (typeof body.forwardTo === 'string' && body.forwardTo.trim()) ||
    campaign.forward_to ||
    process.env.CALL_TRACKING_FALLBACK_NUMBER ||
    null;
  if (!forwardTo) {
    return NextResponse.json(
      { error: 'No forward-to number. Pass forwardTo or set CALL_TRACKING_FALLBACK_NUMBER.' },
      { status: 400 },
    );
  }

  const voiceUrl = `${publicBaseUrl()}/api/twilio/geo/${campaignId}`;
  try {
    const { phoneNumber, sid } = await provisionTrackingNumber({
      voiceUrl,
      areaCode: areaCodeFromPhone(forwardTo),
    });
    await setCampaignTracking(campaignId, { number: phoneNumber, sid, forwardTo });
    return NextResponse.json({ ok: true, number: phoneNumber });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not provision a number.' }, { status: 502 });
  }
}
