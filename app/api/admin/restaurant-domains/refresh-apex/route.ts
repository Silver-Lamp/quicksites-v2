// app/api/admin/restaurant-domains/refresh-apex/route.ts
//
// "Refresh apex" for one claim-contest apex portal: re-assert the apex standards
// (winner-first directory, Home-only chrome, SEO defaults, version stamp) and — since
// apexes are published — republish so the live site changes. Admin-gated; guards +
// the commit/republish live in lib/outreach/restaurantDomains.ts#refreshApexSite.
// `dryRun: true` reports what would apply without writing (the editor coach uses it).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { refreshApexSite } from '@/lib/outreach/restaurantDomains';

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
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });

  const r = await refreshApexSite(campaignId, gate.user.id, { dryRun: body.dryRun === true });
  if (!r.ok) return NextResponse.json({ error: r.error || 'Refresh failed.' }, { status: 400 });
  return NextResponse.json({
    ok: true,
    changed: r.changed,
    applied: r.applied,
    republished: r.republished,
    ...(r.warning ? { warning: r.warning } : {}),
  });
}
