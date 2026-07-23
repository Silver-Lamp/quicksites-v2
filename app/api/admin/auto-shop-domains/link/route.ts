// app/api/admin/auto-shop-domains/link/route.ts
// Add built auto-shop prospects to an existing competition's cohort (admin-gated).
//   POST -> { campaignId, prospectIds } -> { ok, linked }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { linkProspectsToCampaign } from '@/lib/outreach/geoCampaigns';
import { AUTO_SHOP_COMPETITION_KIND } from '@/lib/outreach/competitionKinds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  const prospectIds: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.map(String).filter(Boolean) : [];
  if (!campaignId || !prospectIds.length) return NextResponse.json({ error: 'campaignId + prospectIds required.' }, { status: 400 });

  // Only link into a genuine auto-shop competition.
  const { data: camp } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, kind')
    .eq('id', campaignId)
    .eq('kind', AUTO_SHOP_COMPETITION_KIND)
    .maybeSingle();
  if (!camp) return NextResponse.json({ error: 'Not an auto-shop competition.' }, { status: 404 });

  try {
    await linkProspectsToCampaign(campaignId, prospectIds);
    return NextResponse.json({ ok: true, linked: prospectIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Link failed.' }, { status: 500 });
  }
}
