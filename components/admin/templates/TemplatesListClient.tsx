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

// How many visible (non-archived) rows we want to guarantee on screen
const MIN_ACTIVE_ROWS = 8;

// prefer column boolean, fallback to data.archived
function isRowArchived(t: any): boolean {
  if (typeof t?.archived === 'boolean') return t.archived;
  const raw = t?.data?.archived;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() === 'true';
  return false;
}

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

  // Keep immediate, synchronous references for sequencing loops
  const rowsRef = useRef<any[]>(initialRows);
  const offsetRef = useRef<number>(initialOffset);
  const hasMoreRef = useRef<boolean>(initialHasMore);
  const fillingRef = useRef<boolean>(false);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  useEffect(() => {
    setRows(initialRows);
    setOffset(initialOffset);
    setHasMore(initialHasMore);
    rowsRef.current = initialRows;
    offsetRef.current = initialOffset;
    hasMoreRef.current = initialHasMore;
  }, [initialRows, initialOffset, initialHasMore]);

  const fetchPage = useCallback(
    async (nextOffset: number, replace = false): Promise<any[] | null> => {
      try {
        if (!replace && !hasMoreRef.current) return [];
        setLoading(true);
        setErrorText(null);

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
        const items: any[] = Array.isArray(j?.items) ? j.items : [];
        const nextOff = j?.page?.nextOffset ?? nextOffset + items.length;
        const more = !!j?.page?.hasMore;

        const newRows = replace ? items : [...rowsRef.current, ...items];
        rowsRef.current = newRows;
        setRows(newRows);
        offsetRef.current = nextOff;
        setOffset(nextOff);
        hasMoreRef.current = more;
        setHasMore(more);

        return items;
      } catch (e: any) {
        setErrorText(e?.message || 'Unable to load templates.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [dateParam, includeVersions, pageSize]
  );

  // Count non-archived rows we’d actually show under the default filter (“Active”)
  const countActive = useCallback((arr: any[]) => {
    let n = 0;
    for (const t of arr) if (!isRowArchived(t)) n++;
    return n;
  }, []);

  // Load more pages until we have at least MIN_ACTIVE_ROWS (or run out)
  const fillToMinActive = useCallback(async () => {
    if (fillingRef.current) return;
    fillingRef.current = true;
    try {
      let attempts = 0;
      while (
        countActive(rowsRef.current) < MIN_ACTIVE_ROWS &&
        hasMoreRef.current &&
        attempts < 6 // hard ceiling
      ) {
        const items = await fetchPage(offsetRef.current, false);
        attempts += 1;
        if (!items || items.length === 0) break;
      }
    } finally {
      fillingRef.current = false;
    }
  }, [countActive, fetchPage]);

  // One normalized refetch when the component mounts (first page), then auto-fill
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const got = await fetchPage(0, true);
      if (cancelled) return;
      await fillToMinActive();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // External refresh requests (from Refresh button or table)
  useEffect(() => {
    const handler = async () => {
      await fetchPage(0, true);
      await fillToMinActive();
    };
    window.addEventListener('qs:templates:refetch', handler as EventListener);
    return () => window.removeEventListener('qs:templates:refetch', handler as EventListener);
  }, [fetchPage, fillToMinActive]);

  // Manual “Load more” button
  const onLoadMore = useCallback(async () => {
    await fetchPage(offsetRef.current, false);
  }, [fetchPage]);

  return (
    <>
      {loading && <div className="mb-3 text-xs text-zinc-400">Loading…</div>}
      {errorText && <div className="mb-3 text-xs text-red-400">{errorText}</div>}

      {/* ✅ pass includeVersions so the table can default grouping appropriately */}
      <TemplatesIndexTable templates={rows as any} selectedFilter={dateParam} includeVersions={includeVersions} />
      <div className="mt-4 flex justify-center">
        {hasMore ? (
          <button
            onClick={onLoadMore}
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
