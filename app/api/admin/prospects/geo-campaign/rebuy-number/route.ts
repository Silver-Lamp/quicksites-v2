// app/api/admin/prospects/geo-campaign/rebuy-number/route.ts
//
// Swap a campaign's tracking number for a better-located one.
//
// ⚠️ WHY THIS EXISTS: `seatac-towing.com` was given **+1 419 557 4374 — Toledo, Ohio** because
// 206 was sold out and the old provisioning fell back to "any US number" without saying so. On a
// geo rank-and-rent site the area code IS the pitch, and there was no way to undo it:
// `releaseTrackingNumber` had existed in the library the whole time with ZERO callers, so a
// wrong number could be bought from the admin and never released from it.
//
// ⚠️ BUY FIRST, RELEASE SECOND, AND THAT ORDER IS THE WHOLE SAFETY PROPERTY. Releasing first
// would mean that a market with no local inventory ends up with NO number at all — a live site
// advertising a number that now belongs to nobody, which is strictly worse than the wrong area
// code it replaced. If the new purchase fails, the old number is still attached and still works.
//
// ⚠️ The business is NOT re-notified. `sendForwardNotice` dedupes on `forward_notice_sent_at`,
// so they are told once about the forward, not once per number we happen to buy.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, setCampaignTracking } from '@/lib/outreach/geoCampaigns';
import {
  callTrackingEnabled,
  twilioConfigured,
  provisionTrackingNumber,
  releaseTrackingNumber,
  areaCodeFromPhone,
} from '@/lib/outreach/callTracking';
import { pushTrackingNumberToSite } from '@/lib/ppl/pushTrackingNumberToSite';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!twilioConfigured()) {
    return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 501 });
  }
  if (!callTrackingEnabled()) {
    return NextResponse.json(
      { error: 'Call tracking is disabled. Set CALL_TRACKING_ENABLED=1.', code: 'disabled' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}) as any);
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  const oldNumber = campaign.tracking_number;
  const oldSid = (campaign as any).tracking_number_sid as string | null;
  if (!oldNumber) {
    return NextResponse.json(
      { error: 'This campaign has no number to replace — use Buy instead.' },
      { status: 400 },
    );
  }
  const forwardTo = campaign.forward_to;
  if (!forwardTo) {
    return NextResponse.json({ error: 'Campaign has no forward-to.' }, { status: 400 });
  }

  const voiceUrl = `${publicBaseUrl()}/api/twilio/geo/${campaignId}`;
  let bought: Awaited<ReturnType<typeof provisionTrackingNumber>>;
  try {
    bought = await provisionTrackingNumber({
      voiceUrl,
      smsUrl: `${publicBaseUrl()}/api/twilio/sms/inbound`,
      areaCode: areaCodeFromPhone(forwardTo),
      region: (campaign as any).region ?? null,
      lat: (campaign as any).center_lat ?? null,
      lon: (campaign as any).center_lon ?? null,
      // Off on purpose. If there is nothing local, keeping the number we have beats buying a
      // second badly-located one — this endpoint exists to FIX a badly-located number.
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || 'Could not find a better-located number.',
        code: 'no_local_inventory',
        // Say plainly that nothing changed and nothing was spent.
        kept: oldNumber,
      },
      { status: 409 },
    );
  }

  if (bought.phoneNumber === oldNumber) {
    return NextResponse.json({ ok: true, number: oldNumber, unchanged: true });
  }

  await setCampaignTracking(campaignId, {
    number: bought.phoneNumber,
    sid: bought.sid,
    forwardTo,
  });

  const sitePush = await pushTrackingNumberToSite({
    templateId: (campaign as any).template_id,
    trackingNumber: bought.phoneNumber,
    actorId: operator.id ?? null,
  }).catch((e) => ({ ok: false, fields: 0, republished: false, warning: String(e?.message || e) }));

  // Only now let the old one go. Best-effort: a failed release costs ~$1.15/mo until someone
  // cleans it up, which is a bill — not a broken site.
  let released = false;
  try {
    await releaseTrackingNumber(oldSid);
    released = true;
  } catch {
    /* reported below */
  }

  return NextResponse.json({
    ok: true,
    number: bought.phoneNumber,
    previous: oldNumber,
    released,
    locality: bought.locality,
    site: sitePush,
    ...(released
      ? {}
      : { warning: `Bought ${bought.phoneNumber} but could NOT release ${oldNumber} — it keeps billing until released in the Twilio console.` }),
  });
}
