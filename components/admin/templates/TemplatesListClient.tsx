// components/admin/templates/TemplatesListClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import TemplatesIndexTable from '@/components/admin/templates/templates-index-table';

type Props = {
  initialRows: any[];
  dateParam: string;
  includeVersions: boolean; // 'all' means versions view; otherwise bases (MV) view
  isAdmin: boolean;
  userId: string;
};

/**
 * Client list that:
 * - Uses SSR-provided `initialRows` for instant paint.
 * - In BASES mode (not versions), does ONE on-mount refetch from the unified API,
 *   which enriches rows with site-derived city/phone/industry.
 * - Supports manual refetch via the 'qs:templates:refetch' custom event.
 */
export default function TemplatesListClient({
  initialRows,
  dateParam,
  includeVersions,
}: Props) {
  const [rows, setRows] = useState<any[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // guard so StrictMode doesn't trigger a double refetch
  const didInitialRefetch = useRef(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const refetch = useCallback(
    async (overrides?: Record<string, string>) => {
      try {
        setLoading(true);
        setErrorText(null);

        const sp = new URLSearchParams({
          date: dateParam || '',
          versions: includeVersions ? 'all' : '', // API treats anything-but-'all' as bases mode
          ...(overrides || {}),
        });

        const res = await fetch(`/api/admin/templates/list?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Fetch failed (${res.status})`);
        }
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setRows(items);
      } catch (e: any) {
        setErrorText(e?.message || 'Unable to refresh templates.');
      } finally {
        setLoading(false);
      }
    },
    [dateParam, includeVersions]
  );

  // NEW: do a one-time refetch on mount in BASES mode to pull enriched rows
  useEffect(() => {
    if (includeVersions) return; // versions path already has full fields
    if (didInitialRefetch.current) return;
    didInitialRefetch.current = true;
    void refetch();
  }, [includeVersions, refetch]);

  // Allow external "Refresh" buttons to trigger a refetch
  useEffect(() => {
    const handler = () => { void refetch(); };
    window.addEventListener('qs:templates:refetch', handler as EventListener);
    return () => window.removeEventListener('qs:templates:refetch', handler as EventListener);
  }, [refetch]);

  return (
    <>
      {loading && <div className="mb-3 text-xs text-zinc-400">Refreshing…</div>}
      {errorText && <div className="mb-3 text-xs text-red-400">{errorText}</div>}

      <TemplatesIndexTable templates={rows as any} selectedFilter={dateParam} />
    </>
  );
}
