// components/admin/templates/TemplatesListClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';

type Props = {
  initialRows: any[];
  initialOffset: number;
  initialHasMore: boolean;
  pageSize: number;
  dateParam: string;
  includeVersions: boolean; // 'all' means versions view; otherwise bases (MV) view
  isAdmin: boolean;
  userId: string;
};

export default function TemplatesListClient({
  initialRows,
  initialOffset,
  initialHasMore,
  pageSize,
  dateParam,
  includeVersions,
}: Props) {
  const [rows, setRows] = useState<any[]>(initialRows);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Guard refetch loops
  const didInitialRefetch = useRef(false);

  useEffect(() => {
    setRows(initialRows);
    setOffset(initialOffset);
    setHasMore(initialHasMore);
  }, [initialRows, initialOffset, initialHasMore]);

  const fetchPage = useCallback(
    async (nextOffset: number, replace = false) => {
      setLoading(true);
      setErrorText(null);
      try {
        const sp = new URLSearchParams({
          date: dateParam || '',
          versions: includeVersions ? 'all' : '',
          limit: String(pageSize),
          offset: String(nextOffset),
        });
        const res = await fetch(`/api/admin/templates/list?${sp.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Fetch failed (${res.status})`);
        }
        const j = await res.json();
        const items = Array.isArray(j?.items) ? j.items : [];
        setRows((prev) => (replace ? items : [...prev, ...items]));
        setOffset(j?.page?.nextOffset ?? nextOffset + items.length);
        setHasMore(!!j?.page?.hasMore);
      } catch (e: any) {
        setErrorText(e?.message || 'Unable to load templates.');
      } finally {
        setLoading(false);
      }
    },
    [dateParam, includeVersions, pageSize]
  );

  // One light refetch on mount to ensure server-side + client-side parity (no more 800-row pulls)
  useEffect(() => {
    if (didInitialRefetch.current) return;
    didInitialRefetch.current = true;
    // Replace with the same first page to normalize across nav
    void fetchPage(0, true);
  }, [fetchPage]);

  // External “Refresh” buttons
  useEffect(() => {
    const handler = () => { void fetchPage(0, true); };
    window.addEventListener('qs:templates:refetch', handler as EventListener);
    return () => window.removeEventListener('qs:templates:refetch', handler as EventListener);
  }, [fetchPage]);

  return (
    <>
      {loading && <div className="mb-3 text-xs text-zinc-400">Loading…</div>}
      {errorText && <div className="mb-3 text-xs text-red-400">{errorText}</div>}

      <TemplatesIndexTable templates={rows as any} selectedFilter={dateParam} />

      <div className="mt-4 flex justify-center">
        {hasMore ? (
          <button
            onClick={() => fetchPage(offset)}
            className="px-4 py-2 rounded bg-zinc-800 text-white text-sm border border-white/10 hover:bg-zinc-700"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        ) : (
          <div className="text-xs text-white/40">End of results</div>
        )}
      </div>
    </>
  );
}
