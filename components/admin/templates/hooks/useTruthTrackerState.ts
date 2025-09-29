// hooks/useTruthTrackerState.ts
'use client';

import * as React from 'react';

type HistoryItem = {
  id: string;
  type: string;                  // 'version' | 'snapshot' | ...
  at: string;                    // ISO timestamp
  revAfter?: number | null;
  revBefore?: number | null;
  diff?: { added?: number; changed?: number; removed?: number } | null;
  meta?: any;
};

type SnapshotLite = {
  id: string;
  rev: number | null;
  hash?: string | null;
  createdAt?: string | null;
};

type CombinedState = {
  // original state payload (for anything else you already read elsewhere)
  rawState: any;

  // derived / normalized pieces many panels expect
  infra: {
    template: { rev: number; hash?: string | null };
    site?: { slug?: string | null; publishedSnapshotId?: string | null } | null;
    lastSnapshot?: { id?: string; rev?: number | null; hash?: string | null; createdAt?: string | null } | null;
    cache?: any;
  };
  snapshots: SnapshotLite[];
  versions: HistoryItem[];   // history items of type 'version'
  events: HistoryItem[];     // all history items
};

export function useTruthTrackerState(templateId?: string) {
  const [state, setState] = React.useState<CombinedState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      // Load state + history in parallel
      const [sRes, hRes] = await Promise.all([
        fetch(`/api/templates/state?id=${encodeURIComponent(templateId)}`, { cache: 'no-store' }),
        fetch(`/api/templates/${encodeURIComponent(templateId)}/history`, { cache: 'no-store' }),
      ]);

      const [sJson, hJson] = await Promise.all([sRes.json(), hRes.json()]);
      if (!sRes.ok) throw new Error(sJson?.error || `state ${sRes.status}`);
      if (!hRes.ok) throw new Error(hJson?.error || `history ${hRes.status}`);

      const items: HistoryItem[] = Array.isArray(hJson?.items) ? hJson.items : [];

      // newest first by contract; derive a visible "rev"
      const currentRev = Number(items[0]?.revAfter ?? 0) || 0;

      // Build snapshots list from versions
      const versions = items.filter((i) => (i?.type ?? 'version').toLowerCase() === 'version');
      const snapshots: SnapshotLite[] = versions.map((v) => ({
        id: v.id,
        rev: (typeof v.revAfter === 'number' ? v.revAfter : null),
        hash: v?.meta?.hash ?? v?.meta?.snapshot?.hash ?? null,
        createdAt: v.at ?? null,
      }));

      // Pull a few handy fields out of state (defensive)
      const st = sJson ?? {};
      const publishedSnapshotId =
        st?.site?.publishedSnapshotId ??
        st?.meta_identity?.site?.publishedSnapshotId ??
        st?.data_identity?.site?.publishedSnapshotId ??
        null;

      const lastSnap = st?.lastSnapshot ?? st?.snapshot ?? null;

      const combined: CombinedState = {
        rawState: st,
        infra: {
          template: {
            // prefer derived rev from history; fallback to any rev you may keep in state
            rev: currentRev || Number(st?.rev ?? st?.meta?.rev ?? 0) || 0,
            hash: st?.hash ?? st?.meta?.hash ?? null,
          },
          site: {
            slug: st?.site?.slug ?? st?.slug ?? null,
            publishedSnapshotId,
          },
          lastSnapshot: lastSnap
            ? {
                id: lastSnap.id ?? lastSnap.snapshot_id ?? undefined,
                rev: lastSnap.rev ?? lastSnap.revision ?? null,
                hash: lastSnap.hash ?? null,
                createdAt: lastSnap.createdAt ?? lastSnap.created_at ?? null,
              }
            : null,
          cache: st?.cache ?? null,
        },
        snapshots,
        versions,
        events: items,
      };

      setState(combined);
    } catch (e: any) {
      setError(e?.message || 'failed to load truth');
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  // auto-refresh when commits/snapshots/publish fire
  React.useEffect(() => {
    const onTruth = () => { void reload(); };
    window.addEventListener('qs:truth:refresh', onTruth as any);
    return () => window.removeEventListener('qs:truth:refresh', onTruth as any);
  }, [reload]);

  return { state, loading, error, reload, adminMeta: state?.rawState?.adminMeta ?? null };
}
