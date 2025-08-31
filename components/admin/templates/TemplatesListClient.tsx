// components/admin/templates/TemplatesListClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
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
 * - Uses SSR-provided `initialRows` as the single source of truth.
 * - DOES NOT auto-refetch on mount (prevents "newest → older" flip).
 * - Optional: can refetch on demand from the unified API endpoint.
 */
export default function TemplatesListClient({
  initialRows,
  dateParam,
  includeVersions,
}: Props) {
  const [rows, setRows] = useState<any[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Keep local state in sync when SSR payload changes (e.g., after router.refresh())
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  // Optional on-demand refetch using the unified API (no auto-run on mount)
  const refetch = useCallback(async (overrides?: Record<string, string>) => {
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
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setErrorText(e?.message || 'Unable to refresh templates.');
    } finally {
      setLoading(false);
    }
  }, [dateParam, includeVersions]);

  // (Optional) listen for a custom event if you ever want to trigger client refetch:
  // window.dispatchEvent(new CustomEvent('qs:templates:refetch'))
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
