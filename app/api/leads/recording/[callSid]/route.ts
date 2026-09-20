// app/api/leads/recording/[callSid]/route.ts — stream a call recording to the business that was
// charged for it. Twilio recording URLs need the account's credentials, which never leave the
// server; the statement token proves the caller owns the account, and the call must be on it.

import { NextResponse } from 'next/server';
import { verifyStatementToken } from '@/lib/ppl/statementToken';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ callSid: string }> }) {
  const { callSid } = await ctx.params;
  const t = new URL(req.url).searchParams.get('t');
  const v = verifyStatementToken(t);
  if (!v) return NextResponse.json({ error: 'invalid link' }, { status: 403 });

  const { data: charge } = await supabaseAdmin
    .from('ppl_ledger')
    .select('id')
    .eq('account_id', v.accountId)
    .eq('call_sid', callSid)
    .eq('kind', 'lead_charge')
    .maybeSingle();
  if (!charge) return NextResponse.json({ error: 'not your call' }, { status: 404 });
  const { data: log } = await supabaseAdmin
    .from('call_logs')
    .select('recording_url')
    .eq('call_sid', callSid)
    .maybeSingle();
  const url = log?.recording_url;
  if (!url) return NextResponse.json({ error: 'no recording' }, { status: 404 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token)
    return NextResponse.json({ error: 'recordings unavailable' }, { status: 503 });
  const upstream = await fetch(url.endsWith('.mp3') ? url : `${url}.mp3`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
  });
  if (!upstream.ok || !upstream.body)
    return NextResponse.json({ error: 'recording unavailable' }, { status: 502 });
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="call-${callSid}.mp3"`,
    },
  });
}
