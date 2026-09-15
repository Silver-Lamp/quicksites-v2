// app/api/partners/brand/route.ts
//
// Partner self-serve white-label: GET = the activation checklist state; POST = create or update
// the partner's reseller org (name, support email, accent, logo URLs). Scoped to the signed-in
// partner's own org — never a client-supplied org id. See docs/WHITE_LABEL_PLAN.md slice 4.
import { NextResponse } from 'next/server';
import { partnerWhiteLabelStatus, requirePartner, upsertPartnerOrg } from '@/lib/partners/whiteLabel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json({ ok: true, ...(await partnerWhiteLabelStatus(gate)) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    await upsertPartnerOrg(gate.user.id, {
      name: String(body?.name ?? ''),
      support_email: body?.support_email ?? null,
      accent: body?.accent ?? null,
    });
    return NextResponse.json({ ok: true, ...(await partnerWhiteLabelStatus(gate)) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 400 });
  }
}
