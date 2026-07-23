// app/api/admin/auto-shop-domains/route.ts — the auto-shop competition cockpit feed.
//   GET -> { areas, candidateCities, kpis }   (admin-gated)

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getAutoShopCockpit } from '@/lib/outreach/autoShopDomains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const cockpit = await getAutoShopCockpit();
  return NextResponse.json({ ok: true, ...cockpit });
}
