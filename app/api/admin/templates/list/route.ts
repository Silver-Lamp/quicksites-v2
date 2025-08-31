// app/api/admin/templates/list/route.ts
import { NextResponse } from 'next/server';
import { getFromDate } from '@/lib/getFromDate';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const versions = searchParams.get('versions'); // 'all' → raw templates; anything else → bases
  const fromDate = getFromDate(date);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // admin?
  const { data: adminRow } = await supabase
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  const isAdmin = !!adminRow;

  // default window: 120 days
  const defaultFrom = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const fromIso = (fromDate ?? defaultFrom).toISOString();

  if (versions === 'all') {
    const SELECT = 'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,base_slug,owner_id';
    let q = supabase
      .from('templates')
      .select(SELECT)
      .eq('archived', false)
      .gte('updated_at', fromIso)
      .order('updated_at', { ascending: false })
      .limit(800);
    if (!isAdmin) q = q.eq('owner_id', user.id);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      mode: 'versions',
      items: (data ?? []).map((t) => ({ ...t, effective_updated_at: t.updated_at })),
    });
  }

  // Bases (materialized view path)
  const MV_SELECT =
    'base_slug,canonical_id,canonical_slug,canonical_template_name,canonical_updated_at,canonical_created_at,is_site,archived,industry,color_mode,effective_updated_at';

  const { data, error } = await supabase
    .from('template_bases_secure') // a view over public.template_bases
    .select(MV_SELECT)
    .gte('effective_updated_at', fromIso)
    .order('effective_updated_at', { ascending: false })
    .limit(800);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((r: any) => ({
    id: r.canonical_id,
    slug: r.canonical_slug,
    template_name: r.canonical_template_name,
    updated_at: r.canonical_updated_at,
    created_at: r.canonical_created_at,
    is_site: r.is_site,
    is_version: false,
    archived: r.archived,
    industry: r.industry,
    color_mode: r.color_mode,
    base_slug: r.base_slug,
    effective_updated_at: r.effective_updated_at,
  }));

  return NextResponse.json({ mode: 'bases', items });
}
