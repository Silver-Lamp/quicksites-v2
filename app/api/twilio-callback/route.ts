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
  } = callData;

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

  const { error } = await supabase.from('call_logs').upsert({
    call_sid: CallSid,
    from_number: From,
    to_number: To,
    direction: Direction,
    call_status: CallStatus,
    call_duration: CallDuration ? parseInt(CallDuration, 10) : null,
    template_slug: matchedSlug,
    custom_domain: matchedDomain,
  });

  if (error) {
    console.error('[Twilio webhook] Supabase insert failed:', error);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
