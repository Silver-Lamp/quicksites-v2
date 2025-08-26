export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getFromDate } from '@/lib/getFromDate';
import { getServerSupabase } from '@/lib/supabase/server';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';

type SearchParams = { date?: string; versions?: string };

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

export default async function TemplatesIndexPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await getServerSupabase();

  const dateParam = (searchParams?.date as string) || '';
  const includeVersions = searchParams?.versions === 'all';
  const fromDate = getFromDate(dateParam);

  // Auth (server-side)
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return (
      <div className="mx-auto max-w-6xl p-6 mt-12">
        <p className="text-sm text-zinc-400">Please sign in to view your templates.</p>
      </div>
    );
  }

  // Owner-scoped query (RLS still enforces this)
  let query = supabase
    .from('templates')
    .select('*')
    .eq('archived', false)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  if (fromDate) query = query.gte('updated_at', fromDate.toISOString());

  const { data: templates, error } = await query;
  if (error) {
    console.error('Error loading templates:', error.message);
    return (
      <div className="mx-auto max-w-6xl p-6 mt-12">
        <p className="text-sm text-red-400">Failed to load templates.</p>
      </div>
    );
  }

  const rows = templates ?? [];

  // Group by base slug
  const groups = new Map<string, any[]>();
  for (const t of rows) {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const base = (t as any).base_slug || baseSlug(slug);
    const arr = groups.get(base) || [];
    arr.push(t);
    groups.set(base, arr);
  }

  // Compute effective updated_at per base: max(canonical.updated_at, latest version.updated_at)
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

  const pickPerBase = (items: any[]) => {
    const canonical = items.find(
      (t) => ((t?.slug ?? '') as string) === ((t?.base_slug as string) || baseSlug(t?.slug ?? ''))
    );
    if (canonical) return canonical;

    const withPages = items
      .filter((t) => hasPages(t))
      .sort((a, b) => ts(b.updated_at) - ts(a.updated_at));
    if (withPages[0]) return withPages[0];

    return items.sort((a, b) => ts(b.updated_at) - ts(a.updated_at))[0];
  };

  const attachEffective = (t: any) => {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const base = (t as any).base_slug || baseSlug(slug);
    // for canonical rows use the per-base effective value; for versions keep their own updated_at
    const effective =
      t.is_version ? t.updated_at : effectiveUpdatedByBase.get(base) || t.updated_at;
    return { ...t, effective_updated_at: effective };
  };

  let finalRows: any[];
  if (includeVersions) {
    finalRows = rows.map(attachEffective);
  } else {
    finalRows = Array.from(groups.values()).map(pickPerBase).map(attachEffective);
    // Sort by effective desc so "Updated" ordering makes sense
    finalRows.sort((a, b) => ts(b.effective_updated_at) - ts(a.effective_updated_at));
  }

  return (
    <div className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px] mt-12">
      <TemplatesIndexTable templates={finalRows} selectedFilter={dateParam} />
    </div>
  );
}
