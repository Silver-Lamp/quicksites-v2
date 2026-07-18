// app/api/admin/templates/[id]/area-guide/route.ts
//
// Generate one or more "Homes for sale in <area>" neighborhood area-guide pages on a
// real-estate agent template — hyperlocal SEO surfaces that link back to the agent's home +
// contact. Admin-gated; each page is committed through the sanctioned template RPC and is
// idempotent by slug (re-running skips existing areas). See lib/seo/localPages.ts.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { addAreaGuidePage } from '@/lib/seo/localPagesServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing template id.' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Accept a single `area` or a batch of `areas`.
  const areas: string[] = Array.isArray(body?.areas)
    ? body.areas.map((a: any) => String(a ?? '').trim()).filter(Boolean)
    : typeof body?.area === 'string' && body.area.trim()
      ? [body.area.trim()]
      : [];
  if (!areas.length)
    return NextResponse.json({ error: 'Provide an area (or areas[]).' }, { status: 400 });
  const region = typeof body?.region === 'string' ? body.region : null;
  const highlights = Array.isArray(body?.highlights)
    ? body.highlights.map(String).filter(Boolean)
    : undefined;

  const results = [];
  for (const area of areas.slice(0, 25)) {
    const r = await addAreaGuidePage({ templateId: id, area, region, highlights }, gate.user.id);
    results.push({ area, ...r });
  }
  const created = results.filter((r) => r.changed).length;
  return NextResponse.json({ ok: true, created, results });
}
