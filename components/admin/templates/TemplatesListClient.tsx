// components/admin/templates/TemplatesListClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';
import TemplatesCardGrid from '@/components/admin/templates/templates-card-grid';

type ViewMode = 'cards' | 'table';

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
  const [view, setView] = useState<ViewMode>('cards');

  // Remember the admin's preferred view across visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qs_templates_view');
      if (saved === 'cards' || saved === 'table') setView(saved);
    } catch {}
  }, []);
  const chooseView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem('qs_templates_view', v); } catch {}
  };
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Demo-generation shimmer: show N placeholder cards while demos are minted,
  // and replace them as freshly-generated rows appear.
  const [pendingDemos, setPendingDemos] = useState(0);
  const demoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoBaselineIds = useRef<Set<string>>(new Set());
  const demoTargetRef = useRef(0);

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

  // Demo generation: shimmer placeholders + poll, decrementing as new rows land.
  useEffect(() => {
    const stopPoll = () => {
      if (demoPollRef.current) { clearInterval(demoPollRef.current); demoPollRef.current = null; }
    };
    const onGen = (e: Event) => {
      const count = Math.max(1, Number((e as CustomEvent).detail?.count) || 1);
      demoTargetRef.current = count;
      demoBaselineIds.current = new Set(rowsRef.current.map((r: any) => r.id));
      setPendingDemos(count);
      stopPoll();
      demoPollRef.current = setInterval(async () => {
        await fetchPage(0, true);
        const appeared = rowsRef.current.filter((r: any) => !demoBaselineIds.current.has(r.id)).length;
        const remaining = Math.max(0, demoTargetRef.current - appeared);
        setPendingDemos(remaining);
        if (remaining <= 0) stopPoll();
      }, 4000);
    };
    const onDone = async () => {
      stopPoll();
      await fetchPage(0, true);
      setPendingDemos(0);
    };
    window.addEventListener('qs:demos:generating', onGen as EventListener);
    window.addEventListener('qs:demos:done', onDone as EventListener);
    return () => {
      window.removeEventListener('qs:demos:generating', onGen as EventListener);
      window.removeEventListener('qs:demos:done', onDone as EventListener);
      stopPoll();
    };
  }, [fetchPage]);

  // Manual “Load more” button
  const onLoadMore = useCallback(async () => {
    await fetchPage(offsetRef.current, false);
  }, [fetchPage]);

  return (
    <>
      {loading && <div className="mb-3 text-xs text-zinc-400">Loading…</div>}
      {errorText && <div className="mb-3 text-xs text-red-400">{errorText}</div>}

      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
          <button
            onClick={() => chooseView('cards')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              view === 'cards' ? 'bg-sky-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            onClick={() => chooseView('table')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              view === 'table' ? 'bg-sky-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <TemplatesCardGrid rows={rows as any} pending={pendingDemos} />
      ) : (
        /* ✅ pass includeVersions so the table can default grouping appropriately */
        <TemplatesIndexTable templates={rows as any} selectedFilter={dateParam} includeVersions={includeVersions} />
      )}
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
