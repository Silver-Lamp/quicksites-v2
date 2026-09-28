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
import { isOptedOut, sendForwardNotice } from '@/lib/ppl/forwardNotice';
import { pushTrackingNumberToSite } from '@/lib/ppl/pushTrackingNumberToSite';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!twilioConfigured()) {
    return NextResponse.json(
      { error: 'Twilio is not configured.', code: 'not_configured' },
      { status: 501 }
    );
  }
  if (!callTrackingEnabled()) {
    return NextResponse.json(
      {
        error: 'Call tracking is disabled. Set CALL_TRACKING_ENABLED=1 to buy tracking numbers.',
        code: 'disabled',
      },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId)
    return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  if (campaign.tracking_number) {
    return NextResponse.json({
      ok: true,
      number: campaign.tracking_number,
      alreadyProvisioned: true,
    });
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
      { status: 400 }
    );
  }

  const voiceUrl = `${publicBaseUrl()}/api/twilio/geo/${campaignId}`;
  try {
    // Region + centre so a sold-out area code narrows to the same STATE rather than to
    // anywhere in the US — see provisionTrackingNumber. `allowAnywhere` stays off: an Ohio
    // number on a Washington towing site is a different product, not a lesser success.
    const { phoneNumber, sid, locality } = await provisionTrackingNumber({
      voiceUrl,
      smsUrl: `${publicBaseUrl()}/api/twilio/sms/inbound`,
      areaCode: areaCodeFromPhone(forwardTo),
      region: (campaign as any).region ?? null,
      lat: (campaign as any).center_lat ?? null,
      lon: (campaign as any).center_lon ?? null,
    });
    await setCampaignTracking(campaignId, { number: phoneNumber, sid, forwardTo });

    // ⚠️ THE STEP THAT MAKES THE PURCHASE MEAN ANYTHING. Everything above succeeds while the
    // page a caller sees still advertises the old phone — so the calls go somewhere untracked,
    // the campaign reads "0 calls", and the business we are about to text gets nothing. Never
    // fatal: the number is already bought, so a failure here reports rather than 500s.
    const sitePush = await pushTrackingNumberToSite({
      templateId: campaign.template_id,
      trackingNumber: phoneNumber,
      actorId: operator.id ?? null,
    }).catch((e) => ({ ok: false, fields: 0, republished: false, warning: String(e?.message || e) }));
    // The forwarded business is told once, and can reply STOP (docs/PPL_VERTICAL.md §9).
    // Refused for an opted-out phone: the number is bought but nothing forwards to that business.
    if (await isOptedOut(forwardTo)) {
      await setCampaignTracking(campaignId, { number: phoneNumber, sid, forwardTo: null });
      return NextResponse.json({
        ok: true,
        number: phoneNumber,
        forwardTo: null,
        notice: { sent: false, reason: 'opted_out' },
        site: sitePush,
        locality,
      });
    }
    const notice =
      body.sendNotice === false
        ? { sent: false, reason: 'skipped' }
        : await sendForwardNotice(campaignId);
    return NextResponse.json({ ok: true, number: phoneNumber, forwardTo, notice, site: sitePush, locality });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Could not provision a number.' },
      { status: 502 }
    );
  }
}
