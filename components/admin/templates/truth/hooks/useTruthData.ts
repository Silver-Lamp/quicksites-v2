// components/admin/templates/truth/hooks/useTruthData.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dedupeEvents, safeTruthRefresh } from '../utils';
import type { InfraState, SnapshotInfo, TemplateEvent } from '../types';

export function useTruthData(templateId: string, incoming?: {
  infra?: InfraState;
  snapshots?: SnapshotInfo[];
  events?: TemplateEvent[];
}) {
  const [infra, setInfra] = useState<InfraState | undefined>(incoming?.infra);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | undefined>(incoming?.snapshots);
  const [events, setEvents] = useState<TemplateEvent[] | undefined>(incoming?.events);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [lazyEvents, setLazyEvents] = useState<TemplateEvent[] | null>(null);

  const refreshTruth = useCallback(async () => {
    try {
      const [st, ev] = await Promise.allSettled([
        fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/templates/${templateId}/history`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (st.status === 'fulfilled') {
        setInfra(st.value?.infra ?? infra);
        setSnapshots(Array.isArray(st.value?.snapshots) ? st.value.snapshots : snapshots);
      }
      if (ev.status === 'fulfilled') {
        const arr = Array.isArray(ev.value) ? ev.value : Array.isArray(ev.value?.items) ? ev.value.items : [];
        setLazyEvents(arr);
      }
    } catch {}
  }, [templateId]); // eslint-disable-line

  // initial fetch when not provided
  useEffect(() => {
    if (incoming?.infra) return;
    (async () => {
      try {
        const st = await fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' }).then(r => r.json());
        setInfra(st?.infra);
        setSnapshots(Array.isArray(st?.snapshots) ? st.snapshots : []);
      } catch {}
    })();
  }, [templateId, incoming?.infra]);

  // timeline lazy-load
  useEffect(() => {
    if (!timelineOpen) return;
    if ((incoming?.events && incoming.events.length > 0) || lazyEvents) return;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}/history`, { cache: 'no-store' });
        const json = await res.json();
        const arr = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
        setLazyEvents(arr);
      } catch { setLazyEvents([]); }
    })();
  }, [timelineOpen, incoming?.events, lazyEvents, templateId]);

  // external refresh signal
  useEffect(() => {
    const h = () => void refreshTruth();
    window.addEventListener('qs:truth:refresh', h as any);
    return () => window.removeEventListener('qs:truth:refresh', h as any);
  }, [refreshTruth]);

  const effectiveEvents = useMemo(
    () => dedupeEvents((lazyEvents ?? incoming?.events ?? events) ?? []),
    [lazyEvents, incoming?.events, events]
  );

  // fallbacks for actions (no parent handlers)
  const createSnapshot = useCallback(async () => {
    const res = await fetch(`/api/admin/snapshots/create?templateId=${templateId}`, { cache: 'no-store' });
    if (!res.ok) return;
    safeTruthRefresh();
    await refreshTruth();
  }, [templateId, refreshTruth]);

  const publishSnapshot = useCallback(async (snapshotId: string) => {
    const url = `/api/admin/sites/publish?templateId=${templateId}&snapshotId=${encodeURIComponent(snapshotId)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    safeTruthRefresh();
    await refreshTruth();
  }, [templateId, refreshTruth]);

  const restoreTo = useCallback(async (_id: string) => {
    // TODO: wire to your restore API
    safeTruthRefresh();
    await refreshTruth();
  }, [refreshTruth]);

  return {
    infra, snapshots, effectiveEvents,
    timelineOpen, setTimelineOpen,
    refreshTruth, createSnapshot, publishSnapshot, restoreTo,
  };
}
