// app/api/admin/templates/list/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getFromDate } from '@/lib/getFromDate';

const ts = (d?: string | null) => (d ? new Date(d).getTime() || 0 : 0);
function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch {} }
  return undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || '';
  const versions = url.searchParams.get('versions');
  const includeVersions = versions === 'all';
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 10));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  const supabase = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: adminRow } = await supabase
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  const isAdmin = !!adminRow;

  const fallbackStart = (() => { const d = new Date(); d.setDate(d.getDate() - 120); return d; })();
  const fromIso = (getFromDate(dateParam) ?? fallbackStart).toISOString();

  let items: any[] = [];
  let total = 0;

  if (includeVersions) {
    const SELECT =
      'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,base_slug,owner_id,data,city,phone,banner_url';

    let baseQ = supabase
      .from('templates')
      .select(SELECT, { count: 'exact' })
      .eq('archived', false)
      .gte('updated_at', fromIso)
      .order('updated_at', { ascending: false });

    if (!isAdmin) baseQ = baseQ.eq('owner_id', user.id);

    const { data, error, count } = await baseQ.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items = data ?? [];
    total = count ?? 0;

  } else {
    const MV_SELECT =
      'base_slug,canonical_id,canonical_slug,canonical_template_name,canonical_updated_at,canonical_created_at,is_site,archived,industry,color_mode,effective_updated_at';

    // Prefer secure MV; fallback to raw MV (owner filter applied here)
    let baseQ = supabase
      .from('template_bases_secure')
      .select(MV_SELECT, { count: 'exact' })
      .gte('effective_updated_at', fromIso)
      .order('effective_updated_at', { ascending: false });

    let res: any = await baseQ.range(offset, offset + limit - 1);
    if (res.error) {
      // fallback
      let q2 = supabase
        .from('template_bases')
        .select(MV_SELECT + ',owner_id', { count: 'exact' })
        .gte('effective_updated_at', fromIso)
        .order('effective_updated_at', { ascending: false });

      if (!isAdmin) q2 = q2.eq('owner_id', user.id);
      res = await q2.range(offset, offset + limit - 1);
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

    const baseRows = (res.data ?? []) as any[];
    total = res.count ?? baseRows.length;

    const canonicalIds = baseRows.map((r) => r.canonical_id).filter(Boolean);
    const baseSlugs = baseRows.map((r) => r.base_slug).filter(Boolean);

    // base-level display name
    let nameByBase = new Map<string, string>();
    if (baseSlugs.length) {
      const { data: nameRows } = await supabase
        .from('template_base_meta')
        .select('base_slug,display_name')
        .in('base_slug', baseSlugs);
      if (Array.isArray(nameRows)) {
        for (const r of nameRows) {
          const dn = (r?.display_name || '').trim();
          if (dn) nameByBase.set(r.base_slug, dn);
        }
      }
    }

    // canonical template fields (template_name + data for siteTitle)
    let canonById = new Map<string, any>();
    if (canonicalIds.length) {
      const { data: canonRows } = await supabase
        .from('templates')
        .select('id,template_name,banner_url,city,phone,data')
        .in('id', canonicalIds);
      if (Array.isArray(canonRows)) {
        canonById = new Map(canonRows.map((r: any) => [r.id, r]));
      }
    }

    items = baseRows.map((r: any) => {
      const canon = canonById.get(r.canonical_id) || {};
      const canonData = safeParse<any>(canon?.data);
      const siteTitle = (canonData?.meta?.siteTitle || '').toString().trim();
      const displayName =
        nameByBase.get(r.base_slug) || siteTitle || (canon?.template_name || '').toString().trim() || r.canonical_template_name;

      return {
        id: r.canonical_id,
        slug: r.canonical_slug,
        template_name: displayName,
        display_name: displayName,
        updated_at: r.canonical_updated_at,
        created_at: r.canonical_created_at,
        is_site: r.is_site,
        is_version: false,
        archived: r.archived,
        industry: r.industry,
        city: canon?.city ?? null,
        phone: canon?.phone ?? null,
        color_mode: r.color_mode,
        base_slug: r.base_slug,
        effective_updated_at: r.effective_updated_at,
        banner_url: canon?.banner_url ?? null,
        published: null,
        domain: null,
        data: canonData ?? null,
      };
    });
  }

  const hasMore = offset + items.length < total;
  return NextResponse.json({ items, page: { limit, offset, total, hasMore, nextOffset: offset + items.length } });
}
