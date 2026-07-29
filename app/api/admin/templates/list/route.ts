import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getFromDate } from '@/lib/getFromDate';
import { geoCampaignsByTemplateIds } from '@/lib/outreach/geoCampaigns';
import { readinessScore } from '@/lib/outreach/readiness';
import { resolveIndustryKey } from '@/lib/industries';

type SortKey = 'updated' | 'created' | 'name' | 'seo';
const SORT_KEYS: SortKey[] = ['updated', 'created', 'name', 'seo'];

/**
 * Ensure a { pct, done, total, hardLeft } SEO-readiness score on the item. Prefers
 * the value persisted on the row (templates.seo_readiness, refreshed on commit) and
 * only falls back to computing it for rows not yet backfilled.
 */
function withReadiness(it: any): any {
  const p = it?.seo_readiness;
  if (p && typeof p === 'object' && typeof p.pct === 'number' && typeof p.total === 'number') {
    return it; // persisted (also what the DB sorted by)
  }
  try {
    const meta = (it?.data?.meta ?? it?.data) || {};
    const rawIndustry =
      it?.campaign?.industry_key || meta?.identity?.industry || meta?.industry || it?.industry || '';
    it.seo_readiness = readinessScore(it?.data ?? {}, resolveIndustryKey(rawIndustry));
  } catch {
    it.seo_readiness = null;
  }
  return it;
}

const ts = (d?: string | null) => (d ? new Date(d).getTime() || 0 : 0);
function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch {} }
  return undefined;
}

const stripToken = (s?: string | null) =>
  (s || '').toString().replace(/(-[a-z0-9]{2,12})+$/i, '');

function deriveBaseKey(row: any): string {
  const canonicalId = (row?.canonical_id || '').toString().trim();
  if (canonicalId) return canonicalId;
  // Same base_slug collapse as deriveRootKey — see the note there. Without the qualifier,
  // every geo site in a city shares one base key too, not just one root.
  const baseSlug = (row?.base_slug || '').toString().trim();
  if (baseSlug) return baseSlug + industryQualifier(row);
  const src = (row?.slug || row?.template_name || '').toString();
  if (!src) return row?.id || '';
  const stripped = stripToken(src);
  return stripped || src;
}

/**
 * Industry qualifier for a root key.
 *
 * ⚠️ WHY THIS IS NEEDED. `templates.base_slug` is a GENERATED column:
 *
 *     regexp_replace(coalesce(slug, template_name, ''), '(-[A-Za-z0-9]{2,12})+$', '')
 *
 * It strips trailing `-token` suffixes so a site groups with its random-suffixed variants
 * (graftontowing-08zi → graftontowing). But it cannot tell a random suffix from a real word,
 * so it also strips the INDUSTRY off every geo site:
 *
 *     renton-plumbing   → renton
 *     renton-restaurant → renton
 *     boston-roofing    → boston
 *
 * Every `<city>-<industry>` site in a city therefore shares one root, and aggressive grouping
 * collapses them into a single family — renton-restaurant showed up as a "+1 variant" of
 * Renton Plumbing, and opening it gave an editor titled with the wrong business. Measured
 * across the fleet: Renton 6 industries under one root, Milton 5, Braintree 5, Framingham 5,
 * Arlington 5, Boston 4, Lynn 4, Chelsea 4, Brookline 4.
 *
 * Two sites in different industries are never variants of each other, so qualifying the root
 * key by industry separates them while leaving genuine variant families (same industry, random
 * suffix) grouped exactly as before.
 *
 * This is a display fix. The generated column is the actual root cause and changing it is a
 * schema migration that recomputes every row — deliberately not attempted here.
 */
function industryQualifier(row: any): string {
  const ind = (row?.industry || row?.data?.meta?.industry || '').toString().trim().toLowerCase();
  return ind ? `::${ind}` : '';
}

function deriveRootKey(row: any): string {
  // ⚠️ Do NOT re-strip base_slug. It is maintained by the database (public.base_slug_of +
  // trg_templates_set_base_slug) and is already the correct family root; running stripToken
  // over it re-applies the greedy pattern the 20260809 migration removed, collapsing
  // `renton-plumbing` back to `renton`. stripToken survives only for rows that never
  // persisted a base_slug, where a guess beats nothing.
  const cslug = (row?.canonical_slug || '').toString().trim();
  if (cslug) return cslug + industryQualifier(row);
  const bslug = (row?.base_slug || '').toString().trim();
  if (bslug) return bslug + industryQualifier(row);
  const src = (row?.slug || row?.template_name || '').toString();
  if (!src) return row?.id || '';
  return stripToken(src) + industryQualifier(row);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || '';
  const versions = url.searchParams.get('versions');
  const includeVersions = versions === 'all';
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 10));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  const sortParam = (url.searchParams.get('sort') || 'updated') as SortKey;
  const sort: SortKey = SORT_KEYS.includes(sortParam) ? sortParam : 'updated';
  const asc = (url.searchParams.get('dir') || 'desc') === 'asc';
  const wantSeoSort = sort === 'seo';

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
  // Admins browsing without an explicit date see the full history (no 120-day cutoff).
  const explicitFrom = dateParam ? getFromDate(dateParam) : null;
  const fromIso = (explicitFrom ?? (isAdmin ? new Date(0) : fallbackStart)).toISOString();

  // SEO-readiness sort is a plain ORDER BY on the persisted column (migration
  // 20260721), so it paginates like any other sort — no cap. It queries templates
  // directly (bypassing the base MV, which lacks the column); the list renders flat
  // in this order (the table pauses grouping while a sort is active).
  if (wantSeoSort) {
    const SEO_SELECT = [
      'id','slug','template_name','updated_at','created_at','is_site','is_version','archived',
      'industry','color_mode','base_slug','owner_id','data','city','phone','banner_url','published',
      'seo_readiness','seo_readiness_pct',
    ].join(',');

    let q = supabase
      .from('templates')
      .select(SEO_SELECT, { count: 'exact' })
      .eq('archived', false)
      .gte('updated_at', fromIso)
      .order('seo_readiness_pct', { ascending: asc, nullsFirst: false })
      .order('updated_at', { ascending: false }); // stable tiebreaker
    if (!includeVersions) q = q.eq('is_version', false); // one row per family ≈ base rows
    if (!isAdmin) q = q.eq('owner_id', user.id);

    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const seoItems = (data ?? []).map((row: any) => {
      const jd = safeParse<any>(row?.data) || {};
      const meta = (jd?.meta ?? jd) || {};
      return {
        ...row,
        base_key: deriveBaseKey(row),
        root_key: deriveRootKey(row),
        site_type: meta?.site_type ?? null,
        industry_label: meta?.industry_label ?? null,
        data: jd,
      };
    });

    try {
      const camps = await geoCampaignsByTemplateIds(seoItems.map((it) => it.id).filter(Boolean));
      for (const it of seoItems) { const c = camps[it.id]; if (c) it.campaign = c; }
    } catch { /* best-effort */ }
    for (const it of seoItems) withReadiness(it);

    const seoTotal = count ?? seoItems.length;
    return NextResponse.json({
      items: seoItems,
      page: { limit, offset, total: seoTotal, hasMore: offset + seoItems.length < seoTotal, nextOffset: offset + seoItems.length },
    });
  }

  let items: any[] = [];
  let total = 0;

  if (includeVersions) {
    // Raw templates view (versions & bases)
    const SELECT =
      [
        'id','slug','template_name','updated_at','created_at','is_site','is_version','archived',
        'industry','color_mode','base_slug','owner_id','data','city','phone','banner_url',
        'seo_readiness','seo_readiness_pct'
      ].join(',');

    const col = sort === 'created' ? 'created_at' : sort === 'name' ? 'template_name' : 'updated_at';
    let baseQ = supabase
      .from('templates')
      .select(SELECT, { count: 'exact' })
      .eq('archived', false)
      .gte('updated_at', fromIso)
      .order(col, { ascending: asc });

    if (!isAdmin) baseQ = baseQ.eq('owner_id', user.id);

    const { data, error, count } = await baseQ.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    items = (data ?? []).map((row: any) => {
      const j = safeParse<any>(row?.data) || {};
      const meta = (j?.meta ?? j) || {};
      const site_type = meta?.site_type ?? null;
      const industry_label = meta?.industry_label ?? null;

      return {
        ...row,
        base_key: deriveBaseKey(row),      // ✅ for "Base" grouping
        root_key: deriveRootKey(row),      // ✅ for "Root" grouping
        site_type,
        industry_label,
        data: j,
      };
    });

    total = count ?? items.length;

  } else {
    // Bases (MV) view, one canonical row per family
    const MV_SELECT =
      [
        'base_slug','canonical_id','canonical_slug','canonical_template_name',
        'canonical_updated_at','canonical_created_at','is_site','archived','industry',
        'color_mode','effective_updated_at'
      ].join(',');

    // Admins: full base list (template_bases, no owner scoping). Non-admins: the
    // RLS-scoped secure MV. Fallback to raw MV with a manual owner filter.
    const baseCol =
      sort === 'created' ? 'canonical_created_at' : sort === 'name' ? 'canonical_template_name' : 'effective_updated_at';

    let res: any;
    if (isAdmin) {
      res = await supabase
        .from('template_bases')
        .select(MV_SELECT + ',owner_id', { count: 'exact' })
        .gte('effective_updated_at', fromIso)
        .order(baseCol, { ascending: asc })
        .range(offset, offset + limit - 1);
    } else {
      res = await supabase
        .from('template_bases_secure')
        .select(MV_SELECT, { count: 'exact' })
        .gte('effective_updated_at', fromIso)
        .order(baseCol, { ascending: asc })
        .range(offset, offset + limit - 1);
    }
    if (res.error) {
      let q2 = supabase
        .from('template_bases')
        .select(MV_SELECT + ',owner_id', { count: 'exact' })
        .gte('effective_updated_at', fromIso)
        .order(baseCol, { ascending: asc });

      if (!isAdmin) q2 = q2.eq('owner_id', user.id);
      res = await q2.range(offset, offset + limit - 1);
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

    const baseRows = (res.data ?? []) as any[];
    total = res.count ?? baseRows.length;

    const canonicalIds = baseRows.map((r) => r.canonical_id).filter(Boolean);
    const baseSlugs = baseRows.map((r) => r.base_slug).filter(Boolean);

    // base-level display name (optional)
    const nameByBase = new Map<string, string>();
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

    // canonical template fields (template_name + data for siteTitle & meta typing)
    let canonById = new Map<string, any>();
    if (canonicalIds.length) {
      const { data: canonRows } = await supabase
        .from('templates')
        .select('id,template_name,banner_url,city,phone,data,seo_readiness,seo_readiness_pct')
        .in('id', canonicalIds);
      if (Array.isArray(canonRows)) {
        canonById = new Map(canonRows.map((r: any) => [r.id, r]));
      }
    }

    items = baseRows.map((r: any) => {
      const canon = canonById.get(r.canonical_id) || {};
      const canonData = safeParse<any>(canon?.data) ?? {};
      const meta = (canonData?.meta ?? canonData) || {};
      const site_type = meta?.site_type ?? null;
      const industry_label = meta?.industry_label ?? null;

      const siteTitle = (meta?.siteTitle || '').toString().trim();
      const displayName =
        nameByBase.get(r.base_slug) ||
        siteTitle ||
        (canon?.template_name || '').toString().trim() ||
        r.canonical_template_name;

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
        seo_readiness: canon?.seo_readiness ?? null,
        published: null,
        // Surface the live custom domain (fixes the "View live" link + enables
        // GSC matching); falls back to null → card uses the /sites/<slug> path.
        domain: (meta?.domain ?? meta?.custom_domain ?? canon?.custom_domain ?? canon?.domain ?? null),
        data: canonData ?? null,

        // grouping/display helpers
        canonical_id: r.canonical_id,
        canonical_slug: r.canonical_slug,
        base_key: deriveBaseKey(r),       // canonical_id
        root_key: deriveRootKey(r),       // strip(canonical_slug/base_slug)
        site_type,
        industry_label,
      };
    });
  }

  // Surface geo-domain campaign info on any template that's a campaign pitch site.
  try {
    const tplIds = items.map((it: any) => it.id || it.canonical_id).filter(Boolean);
    const camps = await geoCampaignsByTemplateIds(tplIds);
    for (const it of items as any[]) {
      const c = camps[it.id] || camps[it.canonical_id];
      if (c) it.campaign = c;
    }
  } catch {
    /* best-effort — campaign badges are non-essential */
  }

  // Score every row for display (campaign key feeds industry resolution above, so last).
  for (const it of items as any[]) withReadiness(it);

  const hasMore = offset + items.length < total;
  return NextResponse.json({
    items,
    page: { limit, offset, total, hasMore, nextOffset: offset + items.length },
  });
}
