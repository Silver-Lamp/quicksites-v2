// app/api/admin/collab/feedback/route.ts
//
// Operator-only: record a review of a collab's options, and promote/close one.
//
// Mesh reviews arrive as crosstalk files written by sibling Claude sessions; there is no webhook
// to receive them and there should not be one — a route that accepts "a review" from anywhere is
// a route that publishes unattributed text onto a client's page. An operator pastes it in, which
// is also the moment the AI label gets set.
//
// ⚠️ `reviewerIsAi` IS REQUIRED, NOT DEFAULTED. The DB column is NOT NULL with no default for the
// same reason (see 20260816_collab_feedback.sql): this text renders on a real client's page while
// she decides about her own business, and whether the reviewer was a person is not a question a
// caller may skip. A missing flag is a 400, never a guess — guessing `true` would mislabel a real
// human's note, and guessing `false` is the failure the whole design exists to prevent.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { addFeedback, updateFeedback, type FeedbackSource, type FeedbackStatus } from '@/lib/collab/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCES: FeedbackSource[] = ['mesh', 'persona', 'operator'];
const STATUSES: FeedbackStatus[] = ['new', 'applied', 'dismissed'];

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json().catch(() => ({}) as any);
  const collabId = String(body?.collabId ?? '');
  if (!collabId) return NextResponse.json({ error: 'collabId required' }, { status: 400 });

  const source = String(body?.source ?? '') as FeedbackSource;
  if (!SOURCES.includes(source)) {
    return NextResponse.json({ error: `source must be one of ${SOURCES.join('|')}` }, { status: 400 });
  }

  if (typeof body?.reviewerIsAi !== 'boolean') {
    return NextResponse.json(
      { error: 'reviewerIsAi is required (true/false) — an unlabelled review is not storable' },
      { status: 400 },
    );
  }

  const row = await addFeedback(collabId, {
    source,
    sourceLabel: String(body?.sourceLabel ?? ''),
    reviewerIsAi: body.reviewerIsAi,
    body: String(body?.body ?? ''),
    templateId: body?.templateId ? String(body.templateId) : null,
    pickedOption: body?.pickedOption ? String(body.pickedOption).toUpperCase().slice(0, 2) : null,
    honestyNote: body?.honestyNote ? String(body.honestyNote) : null,
  });

  if (!row) return NextResponse.json({ error: 'could not store review' }, { status: 400 });
  return NextResponse.json({ ok: true, feedback: row });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json().catch(() => ({}) as any);
  const collabId = String(body?.collabId ?? '');
  const id = String(body?.id ?? '');
  if (!collabId || !id) return NextResponse.json({ error: 'collabId and id required' }, { status: 400 });

  const status = body?.status ? (String(body.status) as FeedbackStatus) : undefined;
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join('|')}` }, { status: 400 });
  }

  // Scoped by BOTH ids in the query — a mixed-up id becomes a miss, not a cross-thread write.
  const ok = await updateFeedback(collabId, id, {
    visibleToClient: typeof body?.visibleToClient === 'boolean' ? body.visibleToClient : undefined,
    status,
  });
  if (!ok) return NextResponse.json({ error: 'nothing updated' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
