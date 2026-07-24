// app/api/service-jobs/techs/route.ts
// The shop's known techs (discovered passively via HJ glasses bindings). Owner-gated.
//   GET -> { techs: [{ tech_ref, label, first_bound_at, last_seen_at }] }
// Powers the "say something to the tech" picker. tech_ref is the voice-note target_user_id.

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { listShopTechs, setTechLabel } from '@/lib/serviceJobs/techRoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const techs = await listShopTechs(gate.user.id);
  return NextResponse.json({ techs });
}

// PATCH -> { tech_ref, label } -> rename a discovered tech. Owner-scoped.
export async function PATCH(req: Request) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const techRef = String(body?.tech_ref ?? '').trim();
  if (!techRef) return NextResponse.json({ error: 'missing_tech_ref' }, { status: 400 });

  await setTechLabel(gate.user.id, techRef, String(body?.label ?? ''));
  const techs = await listShopTechs(gate.user.id);
  return NextResponse.json({ ok: true, techs });
}
