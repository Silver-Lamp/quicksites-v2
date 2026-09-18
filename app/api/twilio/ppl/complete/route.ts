// app/api/twilio/ppl/complete/route.ts
//
// The <Dial action> callback for a pay-per-call bridge. Twilio POSTs the bridged leg's outcome
// here (DialCallStatus / DialCallDuration / DialCallSid) once the business hangs up; this is the
// ONE place a lead charge is posted. Signature-verified over the full URL including the query
// string, because that is what Twilio signs — a callback that trusted its body would let anyone
// bill a business $85 by POSTing a CallSid.
//
// Idempotent by construction: Twilio retries on non-2xx, and the ledger's unique index on
// call_sid makes a retry return `already_billed`. Always answers 200 with TwiML, so a billing
// failure (logged + Sentry) never causes Twilio to replay the call flow to the caller.

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { billCompletedCall, pplEnabled } from '@/lib/ppl/billing';
import { hangupTwiml } from '@/lib/ppl/ivr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

function xml(twiml: string, status = 200) {
  return new NextResponse(twiml, { status, headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: Request) {
  if (!pplEnabled()) return NextResponse.json({ error: 'ppl disabled' }, { status: 404 });

  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text).entries());

  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const signature = req.headers.get('x-twilio-signature') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  const u = new URL(req.url);
  const url = `${proto}://${host}${u.pathname}${u.search}`;
  if (!authToken || !twilio.validateRequest(authToken, signature, url, params)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  }

  const campaignId = u.searchParams.get('campaignId') || '';
  const callSid = params.CallSid || '';
  const dialCallSid = params.DialCallSid || null;
  const dialStatus = params.DialCallStatus || null;
  const dialDuration = parseInt(params.DialCallDuration || '0', 10) || 0;
  const from = params.From || null;

  if (!campaignId || !callSid) return xml(hangupTwiml());

  // Keep the call log the rest of the admin reads (best-effort, never blocks billing).
  try {
    await admin.from('call_logs').upsert({
      call_sid: callSid,
      from_number: from,
      to_number: params.To || params.Called || null,
      direction: 'inbound',
      call_status: dialStatus === 'completed' ? 'completed' : `dial-${dialStatus || 'unknown'}`,
      call_duration: dialDuration,
      geo_campaign_id: campaignId,
    });
  } catch {
    /* logging is best-effort */
  }

  try {
    const result = await billCompletedCall({
      campaignId,
      callSid,
      callerNumber: from,
      dialStatus,
      dialDurationSeconds: dialDuration,
    });
    if (result.outcome === 'billed' && result.reload && !result.reload.ok) {
      Sentry.captureMessage('ppl auto-reload failed', {
        level: 'warning',
        extra: { campaignId, callSid, reason: result.reload.reason },
      } as any);
    }
  } catch (e: any) {
    // The bridged call already happened; a billing error is ours to fix, not the caller's.
    console.error('ppl billing failed', { campaignId, callSid, dialCallSid, message: e?.message });
    Sentry.captureException(e, { extra: { campaignId, callSid, dialCallSid } } as any);
  }

  return xml(hangupTwiml());
}
