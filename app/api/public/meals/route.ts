import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');
    const slug = url.searchParams.get('slug');
    const merchantId = url.searchParams.get('merchantId');
    const q = url.searchParams.get('q')?.trim();
    const cuisineParam = url.searchParams.get('cuisine') || '';
    const includeSoldOut = url.searchParams.get('includeSoldOut') === 'true'; // ← NEW
    const activeOnly = url.searchParams.get('active') !== 'false';            // default true
    const availableNow = url.searchParams.get('availableNow') !== 'false';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 50);
    const cursor = url.searchParams.get('cursor');

    let siteUUID = siteId;
    if (!siteUUID && slug) {
      const { data: site } = await db
        .from('sites')
        .select('id, slug, domain, custom_domain')
        .or(`slug.eq.${slug},domain.eq.${slug},custom_domain.eq.${slug}`)
        .maybeSingle();
      siteUUID = site?.id ?? null;
    }
    if (!siteUUID) return NextResponse.json({ error: 'siteId or slug is required' }, { status: 400 });

    // Base query
    let qb = db
      .from('meals')
      .select('id, slug, site_id, merchant_id, title, description, price_cents, image_url, cuisines, is_active, available_from, available_to, qty_available, max_per_order, created_at')
      .eq('site_id', siteUUID)
      .order('created_at', { ascending: false });

    if (cursor) qb = qb.lt('created_at', cursor);

    // If NOT including sold out, keep the original active filter
    // If including sold out, we’ll filter client-side to (is_active) OR (qty_available == 0)
    if (activeOnly && !includeSoldOut) qb = qb.eq('is_active', true);

    if (merchantId) qb = qb.eq('merchant_id', merchantId);
    if (q) qb = qb.ilike('title', `%${q}%`);

    const cuisines = cuisineParam
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (cuisines.length) qb = qb.overlaps('cuisines', cuisines);

    // Overfetch to compensate for window & sold-out filtering
    const rawLimit = Math.min(limit * 2, 100);
    qb = qb.limit(rawLimit);

    const { data: raw, error } = await qb;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Availability window filter
    const now = new Date();
    let filtered = (raw ?? []).filter(m => {
      if (!availableNow) return true;
      const fromOK = !m.available_from || new Date(m.available_from) <= now;
      const toOK = !m.available_to || new Date(m.available_to) >= now;
      return fromOK && toOK;
    });

    // Include sold-out (qty_available == 0) even if not active
    if (includeSoldOut) {
      filtered = filtered.filter(m => m.is_active || m.qty_available === 0);
    }

    // Slice & cursor
    const meals = filtered.slice(0, limit);
    const nextCursor = meals.length === limit ? meals[meals.length - 1].created_at : null;

    return NextResponse.json({ meals, nextCursor });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
