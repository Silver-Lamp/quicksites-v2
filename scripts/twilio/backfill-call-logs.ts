import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const client = twilio(accountSid, authToken);

async function backfillCalls() {
  const calls = await client.calls.list({ limit: 50 });

  for (const call of calls) {
    await supabase.from('call_logs').upsert({
      call_sid: call.sid,
      from_number: call.from,
      to_number: call.to,
      direction: call.direction,
      call_status: call.status,
      call_duration: parseInt(call.duration ?? '0', 10),
      timestamp: new Date(call.startTime),
    });
  }
}

backfillCalls();
