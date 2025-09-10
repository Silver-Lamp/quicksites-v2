// app/admin/templates/list/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getServerSupabase } from '@/lib/supabase/server';
import TemplatesListClient from '@/components/admin/templates/TemplatesListClient';
import RefreshTemplatesButton from '@/components/admin/templates/RefreshTemplatesButton';

type SearchParams = { date?: string; versions?: string };

const PAGE_SIZE = 10;

export default async function TemplatesIndexPage({ searchParams }: { searchParams: Promise<SearchParams> | SearchParams }) {
  const supabase = await getServerSupabase();
  const sp = typeof (searchParams as any)?.then === 'function' ? await (searchParams as Promise<SearchParams>) : ((searchParams as SearchParams) || {});
  const dateParam = (sp?.date as string) || '';
  const includeVersions = sp?.versions === 'all';

  // auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl p-6 mt-12">
        <p className="text-sm text-zinc-400">Please sign in to view your templates.</p>
      </div>
    );
  }

  // Use our API route for the first page so server+client are in sync
  const qs = new URLSearchParams({ date: dateParam, versions: includeVersions ? 'all' : '', limit: String(PAGE_SIZE), offset: '0' });
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/templates/list?${qs.toString()}`, { cache: 'no-store' });
  const j = res.ok ? await res.json() : { items: [] };
  const initialRows = Array.isArray(j.items) ? j.items : [];
  const initialOffset = j?.page?.nextOffset ?? initialRows.length;
  const initialHasMore = !!j?.page?.hasMore;

  return (
    <div className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px] mt-12">
      <div className="flex items-center justify-between mb-4 mt-8">
        <RefreshTemplatesButton />
      </div>
      <TemplatesListClient
        initialRows={initialRows}
        initialOffset={initialOffset}
        initialHasMore={initialHasMore}
        pageSize={PAGE_SIZE}
        dateParam={dateParam}
        includeVersions={includeVersions}
        isAdmin={true}
        userId={user.id}
      />
    </div>
  );
}
