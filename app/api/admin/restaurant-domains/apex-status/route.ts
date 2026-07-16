// app/api/admin/restaurant-domains/apex-status/route.ts
//
// Standards status for one apex portal, by TEMPLATE id (the editor coach knows the
// open template, not the campaign): resolves the competition this apex fronts
// (meta.apex_campaign_id, falling back to the campaign at the template's slug for
// converted pitch sites that predate the stamp), dry-runs applyApexStandards, and
// returns what a "Refresh apex" would fix. Admin-gated read; never writes.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { applyApexStandards, APEX_STANDARDS_VERSION } from '@/lib/outreach/apexStandards';
import { RESTAURANT_COMPETITION_KIND } from '@/lib/outreach/restaurantCompetition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const templateId = new URL(req.url).searchParams.get('templateId') || '';
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

  const { data: t, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data, header_block, footer_block, published')
    .eq('id', templateId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

  const tpl: any = t;
  const meta = tpl.data?.meta ?? {};

  // The competition this apex fronts: the stamp first, else the campaign at the slug.
  const stampedId = typeof meta.apex_campaign_id === 'string' ? meta.apex_campaign_id : '';
  let q = supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, kind, city, region, domain, slug')
    .eq('kind', RESTAURANT_COMPETITION_KIND);
  q = stampedId ? q.eq('id', stampedId) : q.eq('slug', tpl.slug ?? '');
  const { data: c } = await q.maybeSingle();
  if (!c) {
    return NextResponse.json({ ok: false, error: 'no_campaign' }, { status: 404 });
  }

  const r = applyApexStandards({
    data: tpl.data ?? {},
    headerBlock: tpl.header_block ?? null,
    footerBlock: tpl.footer_block ?? null,
    campaignId: c.id,
    city: c.city,
    region: c.region,
  });

  return NextResponse.json({
    ok: true,
    campaignId: c.id,
    domain: c.domain,
    city: c.city,
    region: c.region,
    published: !!tpl.published,
    applied: r.applied, // steps a Refresh apex would run right now ([] = up to date)
    changed: r.changed,
    version: typeof meta.apex_standards_version === 'number' ? meta.apex_standards_version : null,
    currentVersion: APEX_STANDARDS_VERSION,
  });
}
