// app/api/admin/prospects/check-ordering/route.ts
//
// Read the ordering platform for a city's swept restaurants (lib/prospects/orderingCheck.ts).
// Admin-only; bounded; writes only on a successful read. Body: { city, region?, limit?,
// recheckAfterDays? }. Returns the tallies, never the HTML.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { checkOrderingForProspects } from '@/lib/prospects/orderingCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  if (!city) return NextResponse.json({ error: 'city_required' }, { status: 400 });
  const result = await checkOrderingForProspects({
    city,
    region: typeof body.region === 'string' ? body.region.trim() || null : null,
    limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined,
    recheckAfterDays: Number.isFinite(Number(body.recheckAfterDays)) ? Number(body.recheckAfterDays) : null,
  });
  return NextResponse.json({ ok: true, ...result });
}
