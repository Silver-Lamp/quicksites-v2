// app/api/twilio-callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const callData = Object.fromEntries(params.entries());

  // Verify this really came from Twilio before trusting the body. Twilio signs
  // over the exact webhook URL + sorted POST params (HMAC-SHA1 with the account
  // auth token). Without this, anyone can POST spoofed call_logs rows.
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const signature = req.headers.get('x-twilio-signature') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  const url = `${proto}://${host}${new URL(req.url).pathname}`;
  if (!authToken || !twilio.validateRequest(authToken, signature, url, callData)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  }

  const {
    CallSid,
    From,
    To,
    Direction,
    CallStatus,
    CallDuration,
    DialCallStatus,
    DialCallDuration,
    RecordingUrl,
  } = callData;

  // This URL is hit three ways: a status callback (CallStatus/CallDuration), a <Dial action>
  // when the bridged leg ends (DialCallStatus/DialCallDuration — the parent call is still
  // "in-progress" at that moment, so CallStatus is useless here), and a recording status
  // callback (RecordingUrl, no status fields at all). Read whichever arrived; never overwrite
  // a real value with undefined.
  const status = DialCallStatus ? `dial-${DialCallStatus}` : CallStatus || undefined;
  const durationRaw = DialCallDuration ?? CallDuration;
  const duration = durationRaw ? parseInt(durationRaw, 10) : undefined;

  // 🔍 Lookup template by phone
  let matchedSlug: string | null = null;
  let matchedDomain: string | null = null;

  // Normalize 'To' for comparison (strip +1 if present)
  const normalizedTo = To?.replace(/^\+1/, '').trim();

  // Look up template where phone matches normalized number
  const { data: match } = await supabase
    .from('templates')
    .select('slug, custom_domain, phone')
    .eq('phone', normalizedTo)
    .maybeSingle();

  if (match) {
    matchedSlug = match.slug;
    matchedDomain = match.custom_domain || null;
  }

  const row: Record<string, unknown> = { call_sid: CallSid };
  if (From) row.from_number = From;
  if (To) row.to_number = To;
  if (Direction) row.direction = Direction;
  if (status) row.call_status = status;
  if (duration !== undefined && !Number.isNaN(duration)) row.call_duration = duration;
  if (matchedSlug) row.template_slug = matchedSlug;
  if (matchedDomain) row.custom_domain = matchedDomain;
  if (RecordingUrl) row.recording_url = RecordingUrl;

  // onConflict is load-bearing: without it upsert resolves on the primary key, a fresh row never
  // matches, and the unique index on call_sid turns every update into a 23505 — the reason 18
  // old Grafton rows carry no status and the 2026-09-19 test calls stayed "ringing".
  const { error } = await supabase.from('call_logs').upsert(row, { onConflict: 'call_sid' });

  if (error) {
    console.error('[Twilio webhook] Supabase insert failed:', error);
    // Still TwiML: a logging failure is ours, and must not make Twilio play "an application
    // error has occurred" to the caller.
  }

  // ⚠️ TwiML, not JSON. As a <Dial action> URL this response is parsed as TwiML; a JSON body
  // is a parse error (Twilio 12100) and the caller hears "an application error has occurred,
  // goodbye" — which is exactly what the first real call through a tracking number got on
  // 2026-09-19. Status/recording callbacks ignore the body, so TwiML is right for all three.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
