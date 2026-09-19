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
import { pplEnabled } from '@/lib/ppl/billing';
import { getPplAccountByCampaign } from '@/lib/ppl/accounts';
import { canRouteCall } from '@/lib/ppl/rules';
import { bridgeTwiml, notConnectingTwiml } from '@/lib/ppl/ivr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

function xml(twiml: string) {
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string
  );
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
      await admin.from('call_logs').upsert(
        {
          call_sid: callSid,
          from_number: searchParams.get('From'),
          to_number: searchParams.get('To'),
          direction: searchParams.get('Direction') || 'inbound',
          call_status: searchParams.get('CallStatus') || 'ringing',
          geo_campaign_id: campaignId,
          custom_domain: campaign?.domain ?? null,
        },
        { onConflict: 'call_sid' }
      );
    }
  } catch {
    /* logging is best-effort */
  }

  // Pay-per-call campaigns (docs/PPL_VERTICAL.md): the balance gate runs BEFORE the bridge, and
  // the bridged leg's outcome goes to the signed /api/twilio/ppl/complete callback, which bills.
  // A campaign with pricing_model='ppl' but no account (or a paused one) connects nothing —
  // the caller is told the line is not connecting, never a made-up reason.
  if (pplEnabled() && campaign?.pricing_model === 'ppl') {
    const account = await getPplAccountByCampaign(campaignId).catch(() => null);
    const businessName = account?.business_name || campaign.domain || 'this business';
    // ⚠️ ONLY the account holder's number — never the campaign's forward_to. Some pitch sites
    // carry a real local provider's number placed for visitor goodwill; that provider never
    // agreed to be bridged with a recording notice, metered, or billed. An account with no
    // contact_phone connects nothing rather than guessing.
    const dest = account?.contact_phone || null;
    if (!account || !canRouteCall(account) || !dest) {
      return xml(
        notConnectingTwiml({ businessName, recordActionUrl: `${base}/api/twilio-callback` })
      );
    }
    const whisper = `New lead from ${campaign.domain ?? 'your QuickSites site'}.`;
    return xml(
      bridgeTwiml({
        businessName,
        forwardTo: dest,
        callerId: searchParams.get('From'),
        actionUrl: `${base}/api/twilio/ppl/complete?campaignId=${encodeURIComponent(campaignId)}`,
        whisperUrl: `${base}/api/twilio/whisper?message=${encodeURIComponent(whisper)}`,
      })
    );
  }

  if (!forwardTo) {
    // No destination yet (unclaimed / no fallback) — take a message instead of failing.
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="polly.Joanna">Thanks for calling. Please leave a message after the tone.</Say><Record maxLength="120" action="${base}/api/twilio-callback" method="POST"/></Response>`
    );
  }

  const whisper = `New lead from ${campaign?.domain ?? 'your QuickSites site'}.`;
  const whisperUrl = `${base}/api/twilio/whisper?message=${encodeURIComponent(whisper)}`;
  // Caller ID = the inbound caller (what the Studio flows did); the default — the Twilio number
  // itself — came back dial-failed on the first route-bridged call. See lib/ppl/ivr.ts.
  const from = searchParams.get('From');
  const callerIdAttr = from ? ` callerId="${esc(from)}"` : '';
  // The bridged leg is recorded, so the caller hears the notice first — Washington and other
  // two-party-consent states require it, and the forwarded business may not be a client.
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="polly.Joanna">This call may be recorded. Please hold while we connect you.</Say>
  <Dial record="record-from-answer-dual" answerOnBridge="true"${callerIdAttr} action="${base}/api/twilio-callback" method="POST" recordingStatusCallback="${base}/api/twilio-callback" recordingStatusCallbackMethod="POST">
    <Number url="${esc(whisperUrl)}">${esc(forwardTo)}</Number>
  </Dial>
</Response>`
  );
}
