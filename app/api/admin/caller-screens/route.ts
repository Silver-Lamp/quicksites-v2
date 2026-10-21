// /api/admin/caller-screens — the operator's side of caller screening (lib/ppl/callerScreen*.ts).
//   GET                                      → { screens: [...] } (active and released)
//   POST { number, evidence?, call_id?, mode? } → screen ('screen', default: offered voicemail) or
//                                              block ('block': rejected unanswered) a number (reason 'operator')
//   POST { number, release: true, note? }    → lift a screen or a block
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listScreens, releaseNumber, screenNumber } from '@/lib/ppl/callerScreenDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ ok: true, screens: await listScreens() });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const number = String(body.number ?? '').trim();
  if (!number) return NextResponse.json({ error: 'number_required' }, { status: 400 });
  if (body.release === true) {
    const r = await releaseNumber({ number, releasedBy: gate.user.id, note: typeof body.note === 'string' ? body.note : null });
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  }
  const mode = body.mode === 'block' ? 'block' : 'screen';
  const r = await screenNumber({
    number,
    reason: 'operator',
    mode,
    evidence: typeof body.evidence === 'string' ? body.evidence : null,
    sourceCallId: typeof body.call_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.call_id) ? body.call_id : null,
    createdBy: gate.user.id,
  });
  return NextResponse.json(r, { status: r.ok ? (r.created ? 201 : 200) : 400 });
}
