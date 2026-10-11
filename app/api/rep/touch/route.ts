// app/api/rep/touch/route.ts
//
// "Texted them" / "Sent the DM": log an outbound touch on a prospect from a rep page or the
// Evolve page's operator strip (owner, 2026-10-11). Who may log: a rep page's signed grant, or a
// signed-in member — the same two doors as /api/rep/build-draft. The body is the message that
// was offered and (the person says) sent; validateTouch refuses an empty one, because a touch
// with no text is a tally, not a record.
import { NextResponse } from 'next/server';
import { verifyRepActionToken } from '@/lib/rep/repActionToken';
import { requireUser } from '@/lib/auth/requireUser';
import { recordTouch, validateTouch } from '@/lib/outreach/touches';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { getProspect } from '@/lib/outreach/prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const TOUCH_CHANNELS = new Set(['sms', 'dm', 'call', 'visit']);

export async function POST(req: Request) {
  const limited = await rateLimitOr429(req, 'rep-touch', 60, 3600);
  if (limited) return limited;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const token = typeof body.token === 'string' && body.token ? body.token : null;
  let actorId: string | null = null;
  let who = '';
  if (token) {
    const grant = verifyRepActionToken(token);
    if (!grant) return NextResponse.json({ error: 'bad_token' }, { status: 403 });
    who = `rep:${grant.code}`;
  } else {
    const u = await requireUser();
    if (u instanceof NextResponse) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    actorId = u.user.id;
    who = `member:${u.user.email ?? u.user.id}`;
  }
  const prospectId = typeof body.prospectId === 'string' ? body.prospectId.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(prospectId)) return NextResponse.json({ error: 'prospect_required' }, { status: 400 });
  const channel = typeof body.channel === 'string' ? body.channel.trim().toLowerCase() : '';
  if (!TOUCH_CHANNELS.has(channel)) return NextResponse.json({ error: 'channel_required' }, { status: 400 });
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  const err = validateTouch({ body: text, channel, direction: 'outbound' });
  if (err) return NextResponse.json({ error: 'body_required', detail: err }, { status: 400 });
  const p = await getProspect(prospectId);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const touch = await recordTouch(
    { prospectId, templateId: p.template_id ?? null, subjectLabel: p.business_name ?? null },
    { direction: 'outbound', channel, body: `${text}\n\n— logged by ${who}`, actorId },
  );
  if (!touch) return NextResponse.json({ error: 'not_recorded' }, { status: 502 });
  return NextResponse.json({ ok: true, occurredAt: touch.occurred_at, channel });
}
