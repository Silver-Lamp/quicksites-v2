// hooks/useTruthTrackerState.ts
'use client';
import * as React from 'react';

export function useTruthTrackerState(templateId?: string) {
  const [state, setState] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/templates/state?id=${encodeURIComponent(templateId)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `state ${r.status}`);
      setState(j);
    } catch (e: any) {
      setError(e?.message || 'failed to load state');
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  React.useEffect(() => { void reload(); }, [reload]);

  // auto-refresh when commits/snapshots/publish fire
  React.useEffect(() => {
    const onTruth = () => { void reload(); };
    window.addEventListener('qs:truth:refresh', onTruth as any);
    return () => window.removeEventListener('qs:truth:refresh', onTruth as any);
  }, [reload]);

  return { state, loading, error, reload };
}
