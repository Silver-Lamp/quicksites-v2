import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

export async function GET(req: NextRequest, { params }: { params: { merchantId: string } }) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');
    const slug = url.searchParams.get('slug');

    let siteUUID = siteId;
    if (!siteUUID && slug) {
      const { data: site } = await db
        .from('sites')
        .select('id, slug, domain, custom_domain')
        .or(`slug.eq.${slug},domain.eq.${slug},custom_domain.eq.${slug}`)
        .maybeSingle();
      siteUUID = site?.id ?? null;
    }

    const fields = 'id, name, display_name, bio, avatar_url, city, region, website_url, social_links, is_public';
    const { data: m, error } = await db.from('merchants').select(fields).eq('id', params.merchantId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!m || m.is_public === false) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Count active meals (optionally for the site)
    let q = db.from('meals').select('id', { count: 'exact', head: true })
      .eq('merchant_id', params.merchantId)
      .eq('is_active', true);
    if (siteUUID) q = q.eq('site_id', siteUUID);
    const { count } = await q;

    return NextResponse.json({
      merchant: {
        id: m.id,
        display_name: m.display_name || m.name,
        bio: m.bio || '',
        avatar_url: m.avatar_url || null,
        city: m.city || null,
        region: m.region || null,
        website_url: m.website_url || null,
        social_links: m.social_links || {},
      },
      stats: { active_meals: count ?? 0 }
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
