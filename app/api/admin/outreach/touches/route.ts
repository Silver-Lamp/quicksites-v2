// app/api/admin/outreach/touches/route.ts
//
// Record and read outreach history. Admin-only: this is data about third parties who never
// signed up, including the verbatim text of what we said to them.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { recordTouch, listTouches, listAllTouches, validateTouch } from '@/lib/outreach/touches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const templateId = sp.get('templateId');
  const prospectId = sp.get('prospectId');
  const label = sp.get('label');

  const touches =
    templateId || prospectId || label
      ? await listTouches({ templateId, prospectId, subjectLabel: label })
      : await listAllTouches();

  return NextResponse.json({ touches });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));

  // ⚠️ Validated here as well as in the database. A touch without a body is not a record, and the
  // point of this whole table is that "I contacted them" without the words is what we already had.
  const err = validateTouch(b);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const touch = await recordTouch(
    { templateId: b.templateId, prospectId: b.prospectId, subjectLabel: b.subjectLabel },
    {
      direction: b.direction,
      channel: b.channel,
      body: b.body,
      attachmentUrl: b.attachmentUrl ?? null,
      attachmentName: b.attachmentName ?? null,
      occurredAt: b.occurredAt ?? null,
      actorId: admin.id ?? null,
    },
  );
  if (!touch) return NextResponse.json({ error: 'Could not save. Nothing was recorded.' }, { status: 500 });
  return NextResponse.json({ ok: true, touch });
}
