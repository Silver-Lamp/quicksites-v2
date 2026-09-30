// app/api/twilio/geo/[campaignId]/whisper/route.ts
//
// What a business hears when the cascade rings it, and the keypress that accepts.
//
// ⚠️ THIS IS THE ROUTE THAT STOPS VOICEMAIL FROM EATING A LEAD. Twilio counts a voicemail
// pickup as an answer, so without a required digit the cascade would stop at the first
// answering machine and bridge a stranded caller to a greeting — which is the exact failure
// (Prime Towing, 3-second `dial-completed`) the cascade exists to fix. A voicemail cannot press
// 1; the `<Gather>` falls through to `<Hangup/>` and the cascade advances.
//
// Distinct from `/api/twilio/whisper`, which is the one-line announcement used by the plain
// single-destination forward. That one informs; this one asks.
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { KEY_TO_LABEL } from '@/lib/industries';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import { cascadeWhisperTwiml } from '@/lib/ppl/cascade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const attempt = new URL(req.url).searchParams.get('attempt') ?? '1';
  const v = await verifyTwilioWebhook(req);
  if (!v.ok) return rejectedTwiml();

  const base = publicBaseUrl();
  const campaign = await getGeoCampaign(campaignId).catch(() => null);
  const trade = (KEY_TO_LABEL as Record<string, string>)[campaign?.industry_key ?? ''] ?? 'local services';

  return xmlResponse(
    cascadeWhisperTwiml({
      trade,
      city: campaign?.city ?? null,
      domain: campaign?.domain ?? 'a QuickSites site',
      acceptUrl: `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/accept?attempt=${encodeURIComponent(attempt)}`,
    }),
  );
}

export const GET = POST;
