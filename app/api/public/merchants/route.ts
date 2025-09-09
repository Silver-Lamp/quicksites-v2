// app/api/public/merchants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');
    const slug = url.searchParams.get('slug');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get('pageSize') || '30', 10)), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    let siteUUID = siteId;
    if (!siteUUID && slug) {
      const { data: site } = await db
        .from('sites')
        .select('id, slug, domain, custom_domain')
        .or(`slug.eq.${slug},domain.eq.${slug},custom_domain.eq.${slug}`)
        .maybeSingle();
      siteUUID = site?.id ?? null;
    }

    // --- No site context: return generic public merchants (with industry) ---
    if (!siteUUID) {
      const { data, error } = await db
        .from('merchants')
        .select('id, display_name, name, avatar_url, city, region, is_public, industry, industry_key')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const unique = Array.from(
        new Map(
          (data ?? []).map((m: any) => [
            m.id,
            {
              id: m.id,
              name: m.display_name || m.name || 'Merchant',
              avatar_url: m.avatar_url || null,
              city: m.city || null,
              region: m.region || null,
              is_public: m.is_public !== false,
              industry: m.industry ?? m.industry_key ?? null,
            },
          ]),
        ).values(),
      );

      const hasMore = unique.length > pageSize;
      const pageItems = unique.slice(0, pageSize);
      return NextResponse.json({ merchants: pageItems, hasMore, nextPage: hasMore ? page + 1 : null }, { status: 200 });
    }

    // --- Site-scoped list (with industry via joined merchants) ---
    const { data, error } = await db
      .from('site_merchants')
      .select(`
        merchant_id, status,
        merchants (
          id, name, display_name, avatar_url, city, region, is_public, industry, industry_key
        )
      `)
      .eq('site_id', siteUUID)
      .eq('status', 'approved')
      .order('merchant_id', { ascending: true })
      .range(from, to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (data ?? [])
      .map((row: any) => {
        const m = row.merchants || {};
        return {
          id: m.id || row.merchant_id,
          name: m.display_name || m.name || 'Merchant',
          avatar_url: m.avatar_url || null,
          city: m.city || null,
          region: m.region || null,
          is_public: m.is_public !== false,
          industry: m.industry ?? m.industry_key ?? null,
        };
      })
      .filter((m) => m.id && m.is_public);

    const unique = Array.from(new Map(list.map((m) => [m.id, m])).values());
    const hasMore = unique.length > pageSize;
    const pageItems = unique.slice(0, pageSize);

    return NextResponse.json({ merchants: pageItems, hasMore, nextPage: hasMore ? page + 1 : null }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

