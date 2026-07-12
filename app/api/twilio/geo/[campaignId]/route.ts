// app/api/twilio/geo/[campaignId]/route.ts
//
// Voice webhook for a geo-domain campaign's tracking number. Twilio hits this when
// someone calls the number; we tag the call with the campaign (for lead-count proof),
// then return TwiML that forwards to the business with a whisper + recording. The
// forwarded leg's status/duration lands via /api/twilio-callback (which retains our
// geo_campaign_id since it doesn't set that column).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

function xml(twiml: string) {
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);
}

export async function GET(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const base = publicBaseUrl();

  const campaign = await getGeoCampaign(campaignId).catch(() => null);
  const forwardTo = campaign?.forward_to || process.env.CALL_TRACKING_FALLBACK_NUMBER || '';

  // Tag the inbound call with the campaign (best-effort — never block forwarding).
  try {
    const callSid = searchParams.get('CallSid');
    if (callSid) {
      await admin.from('call_logs').upsert({
        call_sid: callSid,
        from_number: searchParams.get('From'),
        to_number: searchParams.get('To'),
        direction: searchParams.get('Direction') || 'inbound',
        call_status: searchParams.get('CallStatus') || 'ringing',
        geo_campaign_id: campaignId,
        custom_domain: campaign?.domain ?? null,
      });
    }
  } catch {
    /* logging is best-effort */
  }

  if (!forwardTo) {
    // No destination yet (unclaimed / no fallback) — take a message instead of failing.
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="polly.Joanna">Thanks for calling. Please leave a message after the tone.</Say><Record maxLength="120" action="${base}/api/twilio-callback" method="POST"/></Response>`,
    );
  }

  const whisper = `New lead from ${campaign?.domain ?? 'your QuickSites site'}.`;
  const whisperUrl = `${base}/api/twilio/whisper?message=${encodeURIComponent(whisper)}`;
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual" answerOnBridge="true" action="${base}/api/twilio-callback" method="POST" recordingStatusCallback="${base}/api/twilio-callback" recordingStatusCallbackMethod="POST">
    <Number url="${esc(whisperUrl)}">${esc(forwardTo)}</Number>
  </Dial>
</Response>`,
  );
}
