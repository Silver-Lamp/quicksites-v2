// app/admin/templates/list/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { headers } from 'next/headers';
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

  // Use our API route for the first page so server+client are in sync. Forward
  // the caller's cookies + use an absolute origin so the route sees the signed-in
  // admin (otherwise it 401s and the first paint is empty until the client refetch).
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const origin = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
  const cookieHeader = h.get('cookie') ?? '';

  const qs = new URLSearchParams({ date: dateParam, versions: includeVersions ? 'all' : '', limit: String(PAGE_SIZE), offset: '0' });
  const res = await fetch(`${origin}/api/admin/templates/list?${qs.toString()}`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  const j = res.ok ? await res.json() : { items: [] };
  const initialRows = Array.isArray(j.items) ? j.items : [];
  const initialOffset = j?.page?.nextOffset ?? initialRows.length;
  const initialHasMore = !!j?.page?.hasMore;

  return (
    <div className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px] mt-12">
      <div className="flex items-center justify-between mb-4 mt-8">
      <RefreshTemplatesButton
        dateParam={dateParam}
        includeVersions={includeVersions}
      />
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
