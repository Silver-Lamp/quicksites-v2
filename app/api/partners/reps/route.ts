// app/api/partners/reps/route.ts
//
// A partner's sales reps: GET lists them (code, page link, signups, accrued), POST mints one.
// Scoped through requirePartner() to the signed-in partner's OWN codes — a rep code is created
// under the partner's code and owned by the partner (lib/partners/repCodes.ts). Rate-limited so a
// stuck form cannot mint a hundred codes.
import { NextRequest, NextResponse } from 'next/server';
import { requirePartner } from '@/lib/partners/whiteLabel';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { createRepCode, listReps, validateRepInput } from '@/lib/partners/repCodes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  const reps = await listReps(gate.user.id, gate.codes);
  return NextResponse.json({ ok: true, reps });
}

export async function POST(req: NextRequest) {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  const limited = await rateLimitOr429(req, 'partner-reps', 10, 3600);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const v = validateRepInput(body);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const r = await createRepCode({ partnerUserId: gate.user.id, partnerCode: gate.codes[0], name: v.name, email: v.email, city: v.city, region: v.region });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  const reps = await listReps(gate.user.id, gate.codes);
  return NextResponse.json({ ok: true, created: r, reps }, { status: 201 });
}
