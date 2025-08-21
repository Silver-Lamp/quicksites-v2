// app/admin/templates/list/page.tsx
'use server';

import { getFromDate } from '@/lib/getFromDate';
// import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';
// import VersionsToggle from '@/components/admin/templates/versions-toggle';
import { getServerSupabase } from '@/lib/supabase/server';
import TemplatesIndexWithLoading from '@/components/admin/templates/templates-index-with-loading';

type SearchParams = {
  date?: string;
  versions?: string; // 'all' to show all versions
};

// normalize "deliveredmenu2-im55-cy91" -> "deliveredmenu2"
function baseSlug(slug: string | null | undefined) {
  if (!slug) return '';
  // remove one or more "-token" suffix groups (2–12 alnum chars each)
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}

function isCanonical(slug: string | null | undefined) {
  if (!slug) return false;
  return slug === baseSlug(slug);
}

function hasPages(t: any) {
  // Handles both legacy `pages` and canonical `data.pages`
  const p1 = Array.isArray(t?.pages) && t.pages.length > 0;
  const p2 = Array.isArray(t?.data?.pages) && t.data.pages.length > 0;
  return p1 || p2;
}

export default async function TemplatesIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await getServerSupabase();

  const resolvedParams = await searchParams;
  const dateParam = resolvedParams?.date || '';
  const includeVersions = resolvedParams?.versions === 'all';
  const fromDate = getFromDate(dateParam);

  let query = supabase
    .from('templates')
    .select('*')
    .order('updated_at', { ascending: false })
    .eq('archived', false);

  if (fromDate) {
    query = query.gte('updated_at', fromDate.toISOString());
  }

  const { data: templates, error } = await query;

  if (error) {
    console.error('Error loading templates:', error.message);
  }

  const rows = templates || [];

  // Group by base slug (fallbacks keep behavior sane if slug missing)
  const groups = new Map<string, any[]>();
  for (const t of rows) {
    const slug = (t as any).slug || (t as any).template_name || (t as any).id || '';
    const key = baseSlug(slug);
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  }

  // Pick one per base, with strong preferences:
  // 1) Prefer canonical slug row (e.g., "deliveredmenu2")
  // 2) Else prefer a row that actually has pages/content (newest among those)
  // 3) Else the newest row by updated_at
  const pickPerBase = (items: any[]) => {
    const canonical = items.find((t) =>
      isCanonical((t as any).slug || (t as any).template_name)
    );
    if (canonical) return canonical;

    const withPages = items
      .filter((t) => hasPages(t))
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    if (withPages[0]) return withPages[0];

    return items.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
  };

  const deduped = includeVersions ? rows : Array.from(groups.values()).map(pickPerBase);
  const hiddenCount = rows.length - deduped.length;

  return (
    <>
      {/* Header / controls above the table */}
      {/* <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          {deduped.length} template{deduped.length === 1 ? '' : 's'}
        </div>
        <VersionsToggle hiddenCount={hiddenCount} />
      </div> */}

      {/* <TemplatesIndexTable templates={deduped} selectedFilter={dateParam} /> */}
      <TemplatesIndexWithLoading templates={deduped} selectedFilter={dateParam} />
    </>
  );
}
