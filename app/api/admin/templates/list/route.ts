import { NextResponse } from 'next/server';
import { getFromDate } from '@/lib/getFromDate';
import { getServerSupabase } from '@/lib/supabase/server';

/* ---------------- utils ---------------- */

function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  try { return JSON.parse(v) as T; } catch { return undefined; }
}

function titleFromKey(s?: string | null) {
  const v = (s ?? '').toString().trim();
  if (!v) return '';
  return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* -------------- route -------------- */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const versions = searchParams.get('versions'); // 'all' → raw templates; anything else → bases
  const fromDate = getFromDate(date);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // admin?
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  // default window: 120 days
  const defaultFrom = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const fromIso = (fromDate ?? defaultFrom).toISOString();

  /* ---------- Versions mode (raw templates) ---------- */
  if (versions === 'all') {
    const SELECT =
      'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,base_slug,owner_id,data,city,phone,banner_url';

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

  /* ---------- Bases mode (MV + enrichment) ---------- */

  // Keep the view selection minimal to avoid missing-column errors
  const MV_SELECT =
    'base_slug,canonical_id,canonical_slug,canonical_template_name,canonical_updated_at,canonical_created_at,is_site,archived,industry,color_mode,effective_updated_at';

  const { data: baseRows, error: mvErr } = await supabase
    .from('template_bases_secure') // secure view over your MV
    .select(MV_SELECT)
    .gte('effective_updated_at', fromIso)
    .order('effective_updated_at', { ascending: false })
    .limit(800);

  if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 });

  const canonicalIds = (baseRows ?? []).map((r: any) => r.canonical_id).filter(Boolean);
  const batches = chunk(canonicalIds, 100); // 🔑 avoid URL length blowups

  // 1) Enrich from canonical templates (banner_url, city/phone if present, data fallback)
  const canonRowsAll: any[] = [];
  for (const ids of batches) {
    const { data, error } = await supabase
      .from('templates')
      .select('id,banner_url,city,phone,data')
      .in('id', ids)
      .limit(1000);
    if (error) {
      // Don’t fail whole request; log & continue
      console.warn('templates enrichment error:', error.message || error);
      continue;
    }
    if (Array.isArray(data)) canonRowsAll.push(...data);
  }
  const canonById = new Map<string, any>(canonRowsAll.map((r: any) => [r.id, r]));

  // 2) Enrich from sites (true industry/city/phone live here)
  const siteRowsAll: any[] = [];
  for (const ids of batches) {
    const { data, error } = await supabase
      .from('sites')
      .select('id,template_id,data,is_published,domain')
      .in('template_id', ids)
      .limit(1000);
    if (error) {
      console.warn('sites enrichment error:', error.message || error);
      continue;
    }
    if (Array.isArray(data)) siteRowsAll.push(...data);
  }
  const siteByTemplateId = new Map<string, any>(
    siteRowsAll.map((r: any) => [r.template_id, r])
  );

  // 3) Merge + resolve display fields
  const items = (baseRows ?? []).map((r: any) => {
    const canon = canonById.get(r.canonical_id) || {};
    const site = siteByTemplateId.get(r.canonical_id) || {};
    const siteData = safeParse<any>(site?.data);
    const meta = (siteData?.meta ?? {}) as any;
    const contact = (meta?.contact ?? {}) as any;

    const siteIndustry =
      (meta?.industry ?? siteData?.industry ?? siteData?.business?.industry) ?? null;
    const siteCity =
      (contact?.city ?? meta?.city ?? siteData?.city ?? siteData?.location?.city) ?? null;
    const sitePhone =
      (contact?.phone ?? meta?.phone ?? siteData?.phone ?? siteData?.contact?.phone) ?? null;

    const resolvedIndustry = titleFromKey(siteIndustry) || r.industry || null;
    const resolvedCity = siteCity || r.city || canon.city || null;
    const resolvedPhone = sitePhone || canon.phone || null;

    return {
      id: r.canonical_id,
      slug: r.canonical_slug,
      template_name: r.canonical_template_name,
      updated_at: r.canonical_updated_at,
      created_at: r.canonical_created_at,
      is_site: r.is_site,
      is_version: false,
      archived: r.archived,
      // table-facing fields
      industry: resolvedIndustry,
      city: resolvedCity,
      phone: resolvedPhone,
      color_mode: r.color_mode,
      base_slug: r.base_slug,
      effective_updated_at: r.effective_updated_at,
      // extras
      banner_url: canon.banner_url ?? null,
      published: site?.is_published ?? null,
      domain: site?.domain ?? null,
      data: siteData ?? canon.data ?? null,
    };
  });

  return NextResponse.json({ mode: 'bases', items });
}
