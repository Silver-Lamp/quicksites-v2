// app/api/admin/prospects/sweep-queue/route.ts
//
// The nightly pipeline's queue. GET lists it; POST adds city × category rows — one city, or a
// whole metro fanned out through lib/prospects/citySeeds.ts; DELETE cancels a queued row.
// Admin-gated. Nothing here spends: the cron does, at its caps.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { citiesForMetro, availableMetros } from '@/lib/prospects/citySeeds';
import { SWEEP_CATEGORIES } from '@/lib/prospects/sweepCategories';
import { listQueue, enqueueSweeps, cancelQueued, pipelineEnabled, pipelineCaps } from '@/lib/tradeSites/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await listQueue(200);
  return NextResponse.json({
    ok: true,
    enabled: pipelineEnabled(),
    caps: pipelineCaps(),
    rows,
    metros: availableMetros(),
    categories: SWEEP_CATEGORIES.filter((c) => c.label !== 'Restaurants').map((c) => c.label),
  });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const categories: string[] = Array.isArray(body.categories) ? body.categories.map(String) : body.category ? [String(body.category)] : [];
  if (!categories.length) return NextResponse.json({ error: 'Pick at least one category.' }, { status: 400 });

  const cities: Array<{ city: string; region: string }> = [];
  if (typeof body.metro === 'string' && body.metro.trim()) {
    const seeds = citiesForMetro(body.metro);
    if (!seeds.length) return NextResponse.json({ error: `Unknown metro. Known: ${availableMetros().join(', ')}` }, { status: 400 });
    cities.push(...seeds);
  } else if (typeof body.city === 'string' && body.city.trim()) {
    cities.push({ city: body.city.trim(), region: String(body.region ?? '').trim() });
  } else {
    return NextResponse.json({ error: 'Provide a city + region, or a metro.' }, { status: 400 });
  }

  const rows = cities.flatMap((c) => categories.map((category) => ({ ...c, category, radiusMeters: Number(body.radiusMeters) || undefined, priority: Number(body.priority) || 0 })));
  const r = await enqueueSweeps(rows, admin.id);
  return NextResponse.json({ ok: true, ...r, enabled: pipelineEnabled(), caps: pipelineCaps() });
}

export async function DELETE(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const ok = await cancelQueued(id);
  return NextResponse.json({ ok });
}
