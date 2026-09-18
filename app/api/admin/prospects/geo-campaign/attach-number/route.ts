// app/api/admin/prospects/geo-campaign/attach-number/route.ts
//
// Point an EXISTING Twilio number at a campaign (docs/PPL_VERTICAL.md §8 step 1c / §9).
// Sibling of provision-number, which BUYS one. This is how a number Sandon bought by hand in
// the console — or one already forwarding through a Studio flow, like graftontowing.com's
// 262-228-2491 — starts landing in call_logs: the voice URL moves to /api/twilio/geo/<id>,
// which forwards exactly as before (notice → record → dial) with a SIGNED outcome callback.
//
// Costs nothing, so it is not behind CALL_TRACKING_ENABLED; it is admin-gated and needs Twilio
// configured. Returns what the number pointed at before, so the change is reversible by hand.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getGeoCampaign, setCampaignTracking } from '@/lib/outreach/geoCampaigns';
import { attachTrackingNumber, twilioConfigured } from '@/lib/outreach/callTracking';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendForwardNotice } from '@/lib/ppl/forwardNotice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  campaignId: z.string().uuid().optional(),
  /** Alternative to campaignId: the campaign's domain. */
  domain: z.string().min(3).optional(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'E.164 phone'),
  /** Where the bridged call goes. Optional when the campaign already has one. */
  forwardTo: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'E.164 phone')
    .optional(),
  /** Send the one-time "calls are being forwarded to you" SMS to forwardTo. Default true. */
  sendNotice: z.boolean().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  if (!twilioConfigured()) {
    return NextResponse.json(
      { error: 'Twilio is not configured in this environment.' },
      { status: 503 }
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const b = parsed.data;

  let campaignId = b.campaignId ?? null;
  if (!campaignId && b.domain) {
    const { data } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id')
      .eq('domain', b.domain.toLowerCase().replace(/^www\./, ''))
      .maybeSingle();
    campaignId = data?.id ?? null;
  }
  if (!campaignId)
    return NextResponse.json(
      { error: 'campaignId or a known domain is required' },
      { status: 400 }
    );

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  if (campaign.tracking_number && campaign.tracking_number !== b.phoneNumber) {
    return NextResponse.json(
      {
        error: `Campaign already has ${campaign.tracking_number}; release it first.`,
        code: 'already_tracked',
      },
      { status: 409 }
    );
  }
  const forwardTo = b.forwardTo ?? campaign.forward_to ?? null;
  if (!forwardTo)
    return NextResponse.json(
      { error: 'forwardTo is required (the campaign has none).' },
      { status: 400 }
    );

  const voiceUrl = `${publicBaseUrl()}/api/twilio/geo/${campaignId}`;
  const smsUrl = `${publicBaseUrl()}/api/twilio/sms/inbound`;
  try {
    const r = await attachTrackingNumber({ phoneNumber: b.phoneNumber, voiceUrl, smsUrl });
    await setCampaignTracking(campaignId, { number: b.phoneNumber, sid: r.sid, forwardTo });
    // The forwarded business is told once (§9). The operator can hold it back at attach time,
    // e.g. when the business has already agreed in person.
    const notice =
      b.sendNotice === false
        ? { sent: false as const, reason: 'skipped' as const }
        : await sendForwardNotice(campaignId);
    return NextResponse.json({
      ok: true,
      campaignId,
      number: b.phoneNumber,
      forwardTo,
      voiceUrl,
      smsUrl,
      notice,
      previous: {
        voiceUrl: r.previousVoiceUrl,
        voiceApplicationSid: r.previousVoiceApplicationSid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Could not attach the number.' },
      { status: 502 }
    );
  }
}
