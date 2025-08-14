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
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get('pageSize') || '30', 10)), 100);
  
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
  
      const start = (page - 1) * pageSize;
      const end   = start + pageSize; // request one extra
      const { data, error } = await db
        .from('site_merchants')
        .select(`
          merchant_id, status,
          merchants ( id, name, display_name, avatar_url, city, region, is_public )
        `)
        .eq('site_id', siteUUID)
        .eq('status', 'approved')
        .order('merchant_id', { ascending: true })
        .range(start, end); // pageSize+1
  
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
      const list = (data ?? [])
        .map((row: any) => {
          const m = row.merchants || {};
          return {
            id: m.id || row.merchant_id,
            name: m.display_name || m.name || 'Chef',
            avatar_url: m.avatar_url || null,
            city: m.city || null,
            region: m.region || null,
            is_public: m.is_public !== false
          };
        })
        .filter(m => m.id && m.is_public);
  
      const unique = Array.from(new Map(list.map(m => [m.id, m])).values());
      const hasMore = unique.length > pageSize;
      const pageItems = unique.slice(0, pageSize);
  
      return NextResponse.json({ merchants: pageItems, hasMore, nextPage: hasMore ? page + 1 : null });
    } catch (e: any) {
      console.error(e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }