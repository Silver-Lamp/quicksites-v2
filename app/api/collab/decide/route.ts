// app/api/collab/decide/route.ts
//
// The client records which layout they want. Token-scoped: the collab comes from the token, and
// recordDecision refuses any template that was not actually on offer in that thread.
import { NextResponse } from 'next/server';
import { verifyCollabToken } from '@/lib/collab/collabToken';
import { recordDecision, postMessage, getCollab, optionLabelFor } from '@/lib/collab/collabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);
  const viaToken = verifyCollabToken(body?.token);
  if (!viaToken) return NextResponse.json({ error: 'not authorised' }, { status: 401 });

  // ⚠️ NULL IS A VALID CHOICE: "actually, I haven't decided". A one-click irreversible pick is
  // a trap — the owner mis-clicked it on the client's behalf within minutes of the page going
  // live, and there was no way back. A preference you cannot withdraw is not a preference.
  const raw = body?.templateId;
  const templateId = raw === null || raw === '' ? null : String(raw ?? '');

  const before = await getCollab(viaToken.collabId);
  const changed = (before?.decided_template_id ?? null) !== templateId;

  const ok = await recordDecision(viaToken.collabId, templateId);
  if (!ok) return NextResponse.json({ error: 'That option is not on offer here.' }, { status: 400 });

  // Trace the decision in the thread — but only when it actually CHANGED. Re-clicking the same
  // option is not a second decision, and repeated identical messages in someone's voice are
  // words they did not say.
  if (changed) {
    // ⚠️ NAME THE OPTION. Two consecutive "Leaning towards this one." lines — which is what
    // switching produces — say nothing about WHICH one, and the thread is meant to be readable
    // months later by someone reconstructing what was agreed.
    // ⚠️ Lineage, not array position. indexOf() returns -1 for every v2, so a revision would be
    // recorded as an unnamed "this one" in the very document meant to say which was chosen.
    const key = before ? await optionLabelFor(before, templateId) : null;
    const label = key ? `Option ${key}` : 'this one';
    await postMessage(viaToken.collabId, {
      authorRole: 'client',
      authorName: before?.client_name ?? null,
      body: templateId ? `Leaning towards ${label}.` : 'Actually — still deciding.',
      templateId,
    });
  }

  return NextResponse.json({ ok: true, decidedTemplateId: templateId });
}
