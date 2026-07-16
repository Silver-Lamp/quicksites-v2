// app/api/admin/restaurant-domains/refresh-ux/route.ts
//
// "Refresh UX" for one restaurant draft: re-apply the scaffold-level improvements
// new builds get automatically (FAQ removal, anchor nav, catering contact title,
// tap-to-call footer). Admin-gated; guards (restaurant industry, drafts only,
// idempotent steps that respect operator edits) live in
// lib/outreach/restaurantDomains.ts#refreshRestaurantUx.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { refreshRestaurantUx } from '@/lib/outreach/restaurantDomains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

  const r = await refreshRestaurantUx(templateId, gate.user.id);
  if (!r.ok) return NextResponse.json({ error: r.error || 'Refresh failed.' }, { status: 400 });
  return NextResponse.json({ ok: true, changed: r.changed, applied: r.applied });
}
