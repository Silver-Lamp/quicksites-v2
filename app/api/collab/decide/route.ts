// app/api/collab/decide/route.ts
//
// The client records which layout they want. Token-scoped: the collab comes from the token, and
// recordDecision refuses any template that was not actually on offer in that thread.
import { NextResponse } from 'next/server';
import { verifyCollabToken } from '@/lib/collab/collabToken';
import { recordDecision, postMessage, getCollab } from '@/lib/collab/collabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);
  const viaToken = verifyCollabToken(body?.token);
  if (!viaToken) return NextResponse.json({ error: 'not authorised' }, { status: 401 });

  const templateId = String(body?.templateId ?? '');
  const ok = await recordDecision(viaToken.collabId, templateId);
  if (!ok) return NextResponse.json({ error: 'That option is not on offer here.' }, { status: 400 });

  // Leave a trace in the thread, so the decision is part of the conversation rather than a
  // silent state change nobody can point at later.
  const collab = await getCollab(viaToken.collabId);
  await postMessage(viaToken.collabId, {
    authorRole: 'client',
    authorName: collab?.client_name ?? null,
    body: 'Picked this one.',
    templateId,
  });

  return NextResponse.json({ ok: true });
}
