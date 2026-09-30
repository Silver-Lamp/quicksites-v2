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
import { cascadeGreetingTwiml } from '@/lib/ppl/cascade';
import { voicemailFirstPromptTwiml } from '@/lib/ppl/voicemail';
import { cascadeEnabled } from '@/lib/ppl/cascadeFlag';
import { KEY_TO_LABEL } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

/** "+12623028118" → "262 302 8118", read as digits by the whisper voice. */
function spokenNumber(e164: string | null): string {
  const d = (e164 ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}

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

  // PPL dials the account holder, not the campaign's forward_to (see the branch below), so the
  // destination is resolved before logging and the log records whichever one is really rung.
  let dialled: string | null = forwardTo || null;

  // Tag the inbound call with the campaign (best-effort — never block forwarding).
  const callSid = searchParams.get('CallSid');
  const logCall = async (extra: Record<string, unknown> = {}) => {
    try {
      if (!callSid) return;
      await admin.from('call_logs').upsert(
        {
          call_sid: callSid,
          from_number: searchParams.get('From'),
          to_number: searchParams.get('To'),
          direction: searchParams.get('Direction') || 'inbound',
          call_status: searchParams.get('CallStatus') || 'ringing',
          geo_campaign_id: campaignId,
          custom_domain: campaign?.domain ?? null,
          // ⚠️ The destination, written at DIAL TIME. `to_number` is our tracking number and the
          // campaign's forward_to is mutable, so without this an answer rate can only be
          // computed against whoever holds the line today — and a re-point silently re-attributes
          // the old destination's no-answers to the new one. See 20260861.
          ...extra,
        },
        { onConflict: 'call_sid' }
      );
    } catch {
      /* logging is best-effort — never block forwarding */
    }
  };

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
      // Nothing was dialled, so nothing is recorded as the destination — a call that never
      // reached anyone must not read later as a business failing to answer.
      await logCall({ forwarded_to: null, handling: 'no_destination' });
      return xml(
        notConnectingTwiml({ businessName, recordActionUrl: `${base}/api/twilio-callback` })
      );
    }
    dialled = dest;
    await logCall({ forwarded_to: dialled, handling: 'ppl' });
    const caller = searchParams.get('From');
    const whisper = `New lead from ${campaign.domain ?? 'your QuickSites site'}${caller ? `, calling from ${spokenNumber(caller)}` : ''}.`;
    return xml(
      bridgeTwiml({
        businessName,
        forwardTo: dest,
        // Our own number as caller ID (full STIR/SHAKEN attestation); the caller's number is in the whisper.
        callerId: campaign.tracking_number ?? searchParams.get('To'),
        actionUrl: `${base}/api/twilio/ppl/complete?campaignId=${encodeURIComponent(campaignId)}`,
        whisperUrl: `${base}/api/twilio/whisper?message=${encodeURIComponent(whisper)}`,
      })
    );
  }

  // ⚠️ CASCADE FIRST WHEN ENABLED, AND IT DELIBERATELY DOES NOT DEPEND ON `forward_to`. The
  // whole finding is that a single designated destination is the wrong mechanism for a trade
  // whose operators are driving — so a campaign with no forward-to at all is a perfectly good
  // cascade, not a broken forward. Flag-gated OFF until the two numbers in
  // docs/CALL_CASCADE_PLAN.md §8 are measured: do callers hold, and does anyone press 1.
  if (cascadeEnabled()) {
    await logCall({ forwarded_to: null, handling: 'cascade' });
    const trade = (KEY_TO_LABEL as Record<string, string>)[campaign?.industry_key ?? ''] ?? 'local';
    return xml(
      cascadeGreetingTwiml({
        trade,
        city: campaign?.city ?? null,
        nextUrl: `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/cascade?attempt=1`,
      }),
    );
  }

  // ⚠️ VOICEMAIL-FIRST. No business is rung: we take the message and relay it
  // (docs/CALL_CASCADE_PLAN.md §13). A campaign reaches this branch by having its `forward_to`
  // cleared, which is the whole flip — there is no second flag, because "who do we ring" and
  // "do we ring anyone" are the same question and two switches could disagree.
  //
  // ⚠️ The old copy here was "Thanks for calling. Please leave a message after the tone." and
  // its Record posted to /api/twilio-callback, which stores the audio and tells NOBODY. That
  // was survivable when this branch only caught campaigns with no destination yet; as the
  // primary path it would be a lead dying silently in a table. It now says what happens to the
  // message and routes to the handler that notifies someone.
  if (!forwardTo) {
    await logCall({ forwarded_to: null, handling: 'voicemail_first' });
    const trade = (KEY_TO_LABEL as Record<string, string>)[campaign?.industry_key ?? ''] ?? 'local';
    return xml(
      voicemailFirstPromptTwiml({
        trade,
        city: campaign?.city ?? null,
        recordActionUrl: `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/voicemail`,
      }),
    );
  }

  const from = searchParams.get('From');
  const whisper = `New lead from ${campaign?.domain ?? 'your QuickSites site'}${from ? `, calling from ${spokenNumber(from)}` : ''}.`;
  const whisperUrl = `${base}/api/twilio/whisper?message=${encodeURIComponent(whisper)}`;
  // Caller ID = OUR tracking number, never the inbound caller's. Twilio's default on a forward is
  // the caller's number, and on 2026-09-19 every such leg failed in 0 s with no SIP response and no
  // STIR attestation — Twilio refused to place a call presenting a number the account does not
  // own. Our own number carries full attestation; the caller's number rides in the whisper.
  const ownNumber = campaign?.tracking_number ?? searchParams.get('To');
  const callerIdAttr = ownNumber ? ` callerId="${esc(ownNumber)}"` : '';
  await logCall({ forwarded_to: dialled, handling: 'forward' });
  // ⚠️ THE BRIDGED LEG IS NO LONGER RECORDED (owner decision, docs/CALL_CASCADE_PLAN.md §9.3).
  // Recording a conversation between a member of the public and a business that never asked us
  // to is a two-party-consent question we could not answer, and nothing consumed the audio. The
  // caller's own VOICEMAIL is still recorded — that one is unambiguous, because leaving it is
  // the caller's deliberate act — so the "may be recorded" notice goes with the prompt that
  // records, not here. Say it where it is true.
  //
  // ⚠️ `action` points at our own after-dial handler rather than /api/twilio-callback. That
  // shared route answers everything with an empty <Response/>, which tells Twilio to HANG UP —
  // which is how a failed forward dropped callers in silence until 2026-09-30. after-dial takes
  // a message instead, and does the call_logs write this route used to rely on it for.
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling. Please hold while I connect you.</Say>
  <Dial answerOnBridge="true"${callerIdAttr} action="${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/after-dial" method="POST">
    <Number url="${esc(whisperUrl)}">${esc(forwardTo)}</Number>
  </Dial>
</Response>`
  );
}
