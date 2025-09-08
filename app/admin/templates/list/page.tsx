// app/admin/templates/list/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getFromDate } from '@/lib/getFromDate';
import { getServerSupabase } from '@/lib/supabase/server';
import TemplatesListClient from '@/components/admin/templates/TemplatesListClient';
import RefreshTemplatesButton from '@/components/admin/templates/RefreshTemplatesButton';

/* -------------------- helpers (server-only) -------------------- */

// normalize "deliveredmenu2-im55-cy91" -> "deliveredmenu2"
function baseSlug(slug: string | null | undefined) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}
const ts = (d?: string | null) => (d ? new Date(d).getTime() || 0 : 0);

function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return undefined; }
  }
  return undefined;
}
function titleFromKey(s?: string | null) {
  const v = (s ?? '').toString().trim();
  if (!v) return '';
  return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Given a flat list of template rows (canonical + versions), compute an
 * "effective" updated_at per base and attach it to each row.
 */
function computeEffective(rows: any[]) {
  // Group by base
  const groups = new Map<string, any[]>();
  for (const t of rows) {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const base = (t as any).base_slug || baseSlug(slug);
    const arr = groups.get(base) || [];
    arr.push(t);
    groups.set(base, arr);
  }

  // For each base, compare canonical.updated_at vs latestVersion.updated_at
  const effectiveUpdatedByBase = new Map<string, string>();
  for (const [base, items] of groups.entries()) {
    const canonical = items.find((x) => !x.is_version) ?? items[0];
    const latestVersion = items
      .filter((x) => x.is_version)
      .sort((a, b) => ts(b.updated_at) - ts(a.updated_at))[0];

    const best =
      ts(latestVersion?.updated_at) > ts(canonical?.updated_at)
        ? latestVersion?.updated_at
        : canonical?.updated_at;

    if (best) effectiveUpdatedByBase.set(base, best);
  }

  const attachEffective = (t: any) => {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const base = (t as any).base_slug || baseSlug(slug);
    const effective =
      t.is_version ? t.updated_at : effectiveUpdatedByBase.get(base) || t.updated_at;
    return { ...t, effective_updated_at: effective };
  };

  return { groups, attachEffective };
}

/* ----------------------------- page (server) ----------------------------- */

type SearchParams = { date?: string; versions?: string };

export default async function TemplatesIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const supabase = await getServerSupabase();

  const sp =
    typeof (searchParams as any)?.then === 'function'
      ? await (searchParams as Promise<SearchParams>)
      : ((searchParams as SearchParams) || {});

  const dateParam = (sp?.date as string) || '';
  const includeVersions = sp?.versions === 'all';
  const fromDate = getFromDate(dateParam);

  // Auth (server-side)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return (
      <div className="mx-auto max-w-6xl p-6 mt-12">
        <p className="text-sm text-zinc-400">Please sign in to view your templates.</p>
      </div>
    );
  }

  // Admin?
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  /* ---------- SKINNY, WINDOWED, LIMITED QUERIES (prevents timeouts) ---------- */

  // Default window: last 120 days unless ?date= provided
  const defaultFrom = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 120);
    return d;
  })();
  const fromIso = (fromDate ?? defaultFrom).toISOString();

  let initialRows: any[] = [];

  if (includeVersions) {
    // Versions path → query templates directly (RLS applies)
    // Include fields the table needs to surface industry/city/phone/preview.
    const SELECT =
      'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,base_slug,owner_id,data,city,phone,banner_url';

    let query = supabase
      .from('templates')
      .select(SELECT)
      .eq('archived', false)
      .gte('updated_at', fromIso)
      .order('updated_at', { ascending: false })
      .limit(800);

    if (!isAdmin) query = query.eq('owner_id', user.id);

    const { data: templates, error } = await query;
    if (error) {
      console.error('Error loading templates:', error.message);
      return (
        <div className="mx-auto max-w-6xl p-6 mt-12">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-red-400">Failed to load templates.</p>
            <RefreshTemplatesButton />
          </div>
        </div>
      );
    }

    const rows = templates ?? [];
    const { attachEffective } = computeEffective(rows);
    initialRows = rows.map(attachEffective);
  } else {
    // Fast path → secure view (owner/admin filter embedded in the view)
    // Keep ONLY columns guaranteed in the secure view to avoid errors.
    const MV_SELECT =
      'base_slug,canonical_id,canonical_slug,canonical_template_name,canonical_updated_at,canonical_created_at,is_site,archived,industry,color_mode,effective_updated_at';

    const { data: bases, error: mvErr } = await supabase
      .from('template_bases_secure')
      .select(MV_SELECT)
      .gte('effective_updated_at', fromIso)
      .order('effective_updated_at', { ascending: false })
      .limit(800);

    if (mvErr) {
      console.error('Error loading template_bases_secure:', mvErr.message);
      return (
        <div className="mx-auto max-w-6xl p-6 mt-12">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-red-400">Failed to load templates.</p>
            <RefreshTemplatesButton />
          </div>
        </div>
      );
    }

    const baseRows = bases ?? [];
    const canonicalIds = baseRows.map((r: any) => r.canonical_id).filter(Boolean);

    // 1) Pull a few fields from canonical templates (banner_url etc.)
    let canonById = new Map<string, any>();
    if (canonicalIds.length > 0) {
      const { data: canonRows } = await supabase
        .from('templates')
        .select('id,banner_url,city,phone,data')
        .in('id', canonicalIds);
      if (Array.isArray(canonRows)) {
        canonById = new Map(canonRows.map((r: any) => [r.id, r]));
      }
    }

    // 2) Pull paired site rows to resolve city/phone/industry from site JSON
    let siteByTemplateId = new Map<string, any>();
    if (canonicalIds.length > 0) {
      const { data: siteRows } = await supabase
        .from('sites')
        .select('id,template_id,data,is_published,domain')
        .in('template_id', canonicalIds);
      if (Array.isArray(siteRows)) {
        siteByTemplateId = new Map(siteRows.map((r: any) => [r.template_id, r]));
      }
    }

    // 3) Merge rows and resolve display fields
    initialRows = baseRows.map((r: any) => {
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

      // Prefer SITE-derived values; fall back to MV or canonical template fields.
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
        // what the table reads:
        industry: resolvedIndustry,
        city: resolvedCity,
        phone: resolvedPhone,
        color_mode: r.color_mode,
        base_slug: r.base_slug,
        effective_updated_at: r.effective_updated_at,
        // extras for other columns
        banner_url: canon.banner_url ?? null,
        published: site?.is_published ?? null,
        domain: site?.domain ?? null,
        // keep a lightweight data for search if needed
        data: siteData ?? canon.data ?? null,
      };
    });
  }

  // Final guard: sort by effective_updated_at desc for consistent ordering
  initialRows.sort(
    (a, b) =>
      new Date(a.effective_updated_at || a.updated_at).getTime() <
      new Date(b.effective_updated_at || b.updated_at).getTime()
        ? 1
        : -1
  );

  return (
    <div className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px] mt-12">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <RefreshTemplatesButton />
      </div>

      <TemplatesListClient
        initialRows={initialRows}
        dateParam={dateParam}
        includeVersions={includeVersions}
        isAdmin={isAdmin}
        userId={user.id}
      />
    </div>
  );
}
