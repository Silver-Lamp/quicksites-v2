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

    let siteUUID = siteId;
    if (!siteUUID && slug) {
      const { data: site } = await db
        .from('sites').select('id, slug, domain, custom_domain')
        .or(`slug.eq.${slug},domain.eq.${slug},custom_domain.eq.${slug}`)
        .maybeSingle();
      siteUUID = site?.id ?? null;
    }
    if (!siteUUID) return NextResponse.json({ error: 'siteId or slug is required' }, { status: 400 });

    // Pull cuisines from active meals only to avoid noise
    const { data, error } = await db
      .from('meals')
      .select('cuisines')
      .eq('site_id', siteUUID)
      .eq('is_active', true)
      .not('cuisines', 'is', null)
      .limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const set = new Set<string>();
    for (const row of data ?? []) {
      (row.cuisines || []).forEach((c: string) => set.add((c || '').toLowerCase()));
    }
    return NextResponse.json({ cuisines: Array.from(set).sort() });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
