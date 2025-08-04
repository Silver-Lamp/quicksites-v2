// app/api/twilio-callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const text = await req.text(); // Twilio sends url-encoded
  const params = new URLSearchParams(text);

  const callData = Object.fromEntries(params.entries());

  const {
    CallSid,
    From,
    To,
    Direction,
    CallStatus,
    CallDuration,
  } = callData;

  const { error } = await supabase.from('call_logs').upsert({
    call_sid: CallSid,
    from_number: From,
    to_number: To,
    direction: Direction,
    call_status: CallStatus,
    call_duration: CallDuration ? parseInt(CallDuration, 10) : null,
  });

  if (error) {
    console.error('Failed to log call:', error);
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
