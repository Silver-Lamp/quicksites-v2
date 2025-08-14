import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  try {
    const url = new URL(req.url);
    const handle = params.handle;
    const byId = UUID_RE.test(handle);

    // When using a slug, require site context (siteId or site slug)
    let siteUUID: string | null = null;
    const siteId = url.searchParams.get('siteId');
    const siteSlug = url.searchParams.get('slug');
    if (!byId) {
      siteUUID = siteId;
      if (!siteUUID && siteSlug) {
        const { data: site } = await db
          .from('sites').select('id, slug, domain, custom_domain')
          .or(`slug.eq.${siteSlug},domain.eq.${siteSlug},custom_domain.eq.${siteSlug}`)
          .maybeSingle();
        siteUUID = site?.id ?? null;
      }
      if (!siteUUID) {
        return NextResponse.json({ error: 'siteId or slug is required for slug lookup' }, { status: 400 });
      }
    }

    const query = db
      .from('meals')
      .select(`
        id, slug, site_id, merchant_id, title, description, price_cents,
        image_url, cuisines, is_active, qty_available, max_per_order,
        created_at,
        merchants ( id, display_name, name, avatar_url )
      `)
      .limit(1);

    const { data, error } = byId
      ? await query.eq('id', handle)
      : await query.eq('site_id', siteUUID!).eq('slug', handle);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const meal = (data || [])[0];
    if (!meal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const merchant = meal.merchants ? {
      id: meal.merchants[0].id,
      name: meal.merchants[0].display_name || meal.merchants[0].name || 'Chef',
      avatar_url: meal.merchants[0].avatar_url || null
    } : null;

    const purchasable = meal.is_active && (meal.qty_available === null || meal.qty_available > 0);

    return NextResponse.json({ meal: { ...meal, merchant, purchasable } });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
