'use client';

import { useEffect, useState, useCallback } from 'react';

export function useTruthTrackerState(templateId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setData(json);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { if (templateId) load(); }, [templateId, load]);

  return { state: data, loading, error: err, refresh: load };
}
