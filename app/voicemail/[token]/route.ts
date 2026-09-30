// app/voicemail/[token]/route.ts
//
// Streams a voicemail to the business we texted. Public, but only to whoever holds the signed
// link — the same shape as the PPL statement link (`lib/ppl/statementToken.ts`): these owners
// will never create an account, and the SMS is the only place the link is delivered.
//
// ⚠️ IT STREAMS. It must never redirect to the Twilio URL, and the SMS must never carry that
// URL. `api.twilio.com/…/Recordings/RE…` needs our account credentials, so a business tapping
// it gets a 401 — a link that looks delivered and plays nothing. The whole reason this route
// exists is to put our auth in front of the audio. Same lesson as `telHref` returning a bare
// number: a thing named for what it delivers has to deliver it.
//
// ⚠️ The token names a CALL, never a URL. If it carried the recording URL, the link would be a
// signed request to fetch an arbitrary address with our Twilio credentials attached — an SSRF
// with authentication. The call SID is looked up and the URL comes from our own row.
import { createClient } from '@supabase/supabase-js';
import { verifyVoicemailToken } from '@/lib/ppl/voicemail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

const TWILIO_RECORDING = /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC[0-9a-f]{32}\/Recordings\/RE[0-9a-f]{32}$/;

function plain(body: string, status: number) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const claim = verifyVoicemailToken(decodeURIComponent(token));
  // One message for bad and expired alike: a tokened URL should not report which it was.
  if (!claim) return plain('This link is no longer valid.', 404);

  const { data } = await admin
    .from('call_logs')
    .select('recording_url')
    .eq('call_sid', claim.callSid)
    .maybeSingle();
  const url = (data as { recording_url: string | null } | null)?.recording_url ?? null;
  if (!url) return plain('No recording for this call.', 404);

  // ⚠️ Belt and braces on top of "the token names a call": the stored value is still checked
  // against Twilio's own recording shape before we attach credentials to a fetch. A bad row —
  // however it got there — must not become an authenticated request to somewhere else.
  if (!TWILIO_RECORDING.test(url)) return plain('No recording for this call.', 404);

  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const auth = process.env.TWILIO_AUTH_TOKEN || '';
  if (!sid || !auth) return plain('Recording playback is not configured.', 503);

  const upstream = await fetch(`${url}.mp3`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}` },
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return plain('Could not load the recording.', 502);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      // Plays in the browser rather than downloading — the recipient is on a phone.
      'Content-Disposition': 'inline; filename="voicemail.mp3"',
      'Cache-Control': 'private, max-age=3600',
      // A voicemail from a member of the public. Never let a crawler at it.
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
