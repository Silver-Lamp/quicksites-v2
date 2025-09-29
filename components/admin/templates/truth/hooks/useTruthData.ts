'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/* ---------- Types (narrow, only what we actually render) ---------- */

export type TruthItem = {
  kind: 'event' | 'version';
  id: string;
  template_id: string | null;
  type: string;
  message: string | null;
  actor_id: string | null;
  meta: any;
  created_at: string; // ISO
};

type InfraState = {
  template: { rev: number; hash?: string | null };
  site?: { slug?: string | null; publishedSnapshotId?: string | null } | null;
  lastSnapshot?: { id?: string; rev?: number; hash?: string | null; createdAt?: string | null } | null;
  cache?: any;
};

type SnapshotLite = { id: string; rev: number; hash?: string | null; createdAt?: string | null };

/* ---------- Helpers ---------- */

function toISO(v?: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

/* ---------- Hook ---------- */

export function useTruthData(templateId?: string) {
  const [items, setItems] = useState<TruthItem[]>([]);
  const [infra, setInfra] = useState<InfraState | null>(null);
  const [loading, setLoading] = useState<boolean>(!!templateId);
  const [error, setError] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<boolean>(false);

  const refreshTruth = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      // 1) History (events + versions, normalized by your API)
      const hist = await getJSON<{ items?: TruthItem[] }>(`/api/templates/${templateId}/history`);
      setItems(Array.isArray(hist?.items) ? hist.items : []);

      // 2) State (for rev/hash/published snapshot/etc.)
      const state = await getJSON<any>(`/api/templates/state?id=${templateId}`);
      // Normalize into an InfraState the tracker expects
      const tmplRev = Number(state?.meta?.rev ?? state?.rev ?? 0);
      const tmplHash = state?.meta?.hash ?? state?.hash ?? undefined;

      const publishedSnapshotId =
        state?.site?.publishedSnapshotId ??
        state?.meta_identity?.site?.publishedSnapshotId ??
        state?.data_identity?.site?.publishedSnapshotId ??
        undefined;

      const lastSnap =
        state?.lastSnapshot ??
        state?.snapshot ??
        undefined;

      setInfra({
        template: { rev: Number.isFinite(tmplRev) ? tmplRev : 0, hash: tmplHash },
        site: {
          slug: state?.site?.slug ?? state?.slug ?? undefined,
          publishedSnapshotId: publishedSnapshotId ?? null,
        },
        lastSnapshot: lastSnap
          ? {
              id: lastSnap.id ?? lastSnap.snapshot_id ?? undefined,
              rev: lastSnap.rev ?? lastSnap.revision ?? undefined,
              hash: lastSnap.hash ?? undefined,
              createdAt: toISO(lastSnap.createdAt ?? lastSnap.created_at ?? null),
            }
          : null,
        cache: state?.cache ?? null,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load truth');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (!templateId) return;
    refreshTruth();
  }, [templateId, refreshTruth]);

  // Derive lightweight "snapshots" list from the history versions we received
  const snapshots: SnapshotLite[] = useMemo(() => {
    return items
      .filter(it => it.kind === 'version')
      .map(it => {
        const rev = Number(it?.meta?.revision ?? it?.meta?.rev ?? it?.meta?.version ?? 0);
        const hash = it?.meta?.hash ?? it?.meta?.diff?.hash ?? undefined;
        return {
          id: it.id,
          rev: Number.isFinite(rev) ? rev : 0,
          hash,
          createdAt: it.created_at,
        };
      })
      // newest first
      .sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1));
  }, [items]);

  // Effective events: keep both events + versions (tracker passes this to <Timeline />)
  const effectiveEvents = items;

  // Actions (wire to your existing routes; safely no-op on error but refresh either way)
  const createSnapshot = useCallback(async () => {
    if (!templateId) return;
    try {
      await getJSON(`/api/admin/snapshots/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
    } finally {
      await refreshTruth();
    }
  }, [templateId, refreshTruth]);

  const publishSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!templateId || !snapshotId) return;
      try {
        await getJSON(`/api/admin/sites/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, snapshotId, versionId: snapshotId }),
        });
      } finally {
        await refreshTruth();
      }
    },
    [templateId, refreshTruth]
  );

  // If you have a concrete restore endpoint, adjust the URL and payload here.
  const restoreTo = useCallback(
    async (snapshotId: string) => {
      if (!templateId || !snapshotId) return;
      try {
        await getJSON(`/api/admin/sites/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, snapshotId }),
        });
      } finally {
        await refreshTruth();
      }
    },
    [templateId, refreshTruth]
  );

  return {
    // what TemplateTruthTracker expects:
    infra,
    snapshots,
    effectiveEvents,
    timelineOpen,
    setTimelineOpen,
    refreshTruth,
    createSnapshot,
    publishSnapshot,
    restoreTo,

    // useful extras if you need them elsewhere:
    loading,
    error,
  };
}
