// app/api/collab/message/route.ts
//
// Post to a collaboration thread, as whoever you actually are.
//
// ⚠️ THE AUTHOR ROLE IS DERIVED FROM HOW YOU AUTHENTICATED, NEVER FROM THE BODY. A valid collab
// token makes you the client; an operator session makes you the operator. If a caller could
// declare their own role, the thread would stop being evidence of what was agreed — which is the
// only reason to keep one.
//
// ⚠️ AND THE COLLAB ID COMES FROM THE TOKEN, NOT THE BODY. A token that authorises "a collab"
// plus a body naming "which collab" is the shape of every IDOR bug ever written.
import { NextResponse } from 'next/server';
import { verifyCollabToken } from '@/lib/collab/collabToken';
import { postMessage, getCollab } from '@/lib/collab/collabs';
import { requireAdmin } from '@/lib/auth/requireUser';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);
  const text = String(body?.body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });

  const ip = clientIp(req);
  const limited = await checkRateLimit(`collab_msg:${ip}`, 30, 3600).catch(() => ({ ok: true }) as any);
  if (!limited?.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429 });

  // Path 1: the client, holding a token for exactly one thread.
  const viaToken = verifyCollabToken(body?.token);
  if (viaToken) {
    const collab = await getCollab(viaToken.collabId);
    if (!collab) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const msg = await postMessage(viaToken.collabId, {
      authorRole: 'client',                       // derived, not declared
      authorName: collab.client_name ?? null,
      body: text,
      kind: body?.answersId ? 'answer' : 'message',
      answersId: typeof body?.answersId === 'string' ? body.answersId : null,
      templateId: typeof body?.templateId === 'string' ? body.templateId : null,
    });
    return msg ? NextResponse.json({ ok: true, message: msg }) : NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  // Path 2: the operator, with a real session. Only here may a collabId come from the body,
  // because requireAdmin has already established who is asking.
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const collabId = typeof body?.collabId === 'string' ? body.collabId : '';
  if (!collabId) return NextResponse.json({ error: 'collabId required' }, { status: 400 });

  const msg = await postMessage(collabId, {
    authorRole: 'operator',                        // derived, not declared
    authorName: typeof body?.authorName === 'string' ? body.authorName : null,
    body: text,
    kind: body?.kind === 'question' ? 'question' : 'message',
    templateId: typeof body?.templateId === 'string' ? body.templateId : null,
  });
  return msg ? NextResponse.json({ ok: true, message: msg }) : NextResponse.json({ error: 'failed' }, { status: 500 });
}
