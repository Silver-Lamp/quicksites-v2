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
function hasPages(t: any) {
  const p1 = Array.isArray(t?.pages) && t.pages.length > 0;
  const p2 = Array.isArray(t?.data?.pages) && t.data.pages.length > 0;
  return p1 || p2;
}
const ts = (d?: string | null) => (d ? new Date(d).getTime() || 0 : 0);

function computeEffective(rows: any[]) {
  const groups = new Map<string, any[]>();
  for (const t of rows) {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const base = (t as any).base_slug || baseSlug(slug);
    const arr = groups.get(base) || [];
    arr.push(t);
    groups.set(base, arr);
  }

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

  const pickPerBase = (items: any[]) => {
    const canonical = items.find(
      (t: any) =>
        ((t?.slug ?? '') as string) ===
        ((t?.base_slug as string) || baseSlug(t?.slug ?? '')),
    );
    if (canonical) return canonical;

    const withPages = items
      .filter((t: any) => hasPages(t))
      .sort((a: any, b: any) => ts(b.updated_at) - ts(a.updated_at));
    if (withPages[0]) return withPages[0];

    return items.sort((a: any, b: any) => ts(b.updated_at) - ts(a.updated_at))[0];
  };

  return { groups, attachEffective, pickPerBase };
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
  const fromIso = fromDate ? fromDate.toISOString() : defaultFrom.toISOString();

  let initialRows: any[] = [];

  if (includeVersions) {
    // Versions path → query templates directly (RLS applies)
    const SELECT =
      'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,base_slug,owner_id';

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

    // includeVersions keeps all rows but attaches effective timestamps
    initialRows = rows.map(attachEffective);
  } else {
    // Fast path → query the secure view (owner/admin filter embedded in the view)
    const MV_SELECT =
      'base_slug,canonical_id,canonical_slug,canonical_template_name,canonical_updated_at,canonical_created_at,is_site,archived,industry,color_mode,effective_updated_at';

    let mv = supabase
      .from('template_bases_secure') // secure view wrapping the MV
      .select(MV_SELECT)
      .gte('effective_updated_at', fromIso)
      .order('effective_updated_at', { ascending: false })
      .limit(800);

    const { data: bases, error: mvErr } = await mv;
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

    initialRows = (bases ?? []).map((r: any) => ({
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
  }

  // Sort by effective_updated_at desc for consistent ordering
  initialRows.sort(
    (a, b) =>
      new Date(b.effective_updated_at || b.updated_at).getTime() -
      new Date(a.effective_updated_at || a.updated_at).getTime(),
  );

  return (
    <div className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px] mt-12">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Templates</h1>
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
