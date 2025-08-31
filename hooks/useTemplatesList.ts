// hooks/useTemplatesList.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { readCache, writeCache, TemplateListItem } from '@/lib/templatesCache';

type Options = {
  /** optional: filter out archived or versions in the list */
  includeArchived?: boolean;
  includeVersions?: boolean;
  pageSize?: number; // full refresh page size
};

export function useTemplatesList(opts: Options = {}) {
  const { includeArchived = true, includeVersions = true, pageSize = 500 } = opts;
  const [items, setItems] = useState<TemplateListItem[]>(() => readCache().list);
  const [loading, setLoading] = useState(items.length === 0);
  const [error, setError] = useState<string | null>(null);

  const running = useRef(false);

  // merge helper
  const merge = (incoming: TemplateListItem[]) => {
    if (!incoming.length) return;
    const map = new Map<string, TemplateListItem>();
    for (const t of items) map.set(t.id, t);
    for (const t of incoming) map.set(t.id, t);
    const next = Array.from(map.values()).sort((a,b) => (b.updated_at > a.updated_at ? 1 : -1));
    setItems(next);
    writeCache(next);
  };

  // build base query with minimal columns
  const baseSelect =
    'id, slug, template_name, updated_at, created_at, is_site, is_version, archived, industry, color_mode';

  const applyFilters = (q: any) => {
    if (!includeArchived) q = q.eq('archived', false);
    if (!includeVersions) q = q.or('is_version.is.null,is_version.eq.false'); // show live/site rows
    return q;
  };

  // initial + delta load
  useEffect(() => {
    if (running.current) return;
    running.current = true;

    const { lastSeenISO } = readCache();

    const load = async () => {
      setError(null);
      try {
        if (lastSeenISO) {
          // 1) delta since lastSeen
          const delta = await applyFilters(
            supabase
              .from('templates')
              .select(baseSelect)
              .gt('updated_at', lastSeenISO)
              .order('updated_at', { ascending: false })
              .limit(pageSize)
          );

          const { data: deltaRows, error: deltaErr } = await delta;
          if (deltaErr) throw deltaErr;
          if (deltaRows && deltaRows.length) merge(deltaRows as any);

          // 2) (optional) small sanity sweep for very old evictions
          if (items.length === 0) {
            const full = await applyFilters(
              supabase
                .from('templates')
                .select(baseSelect)
                .order('updated_at', { ascending: false })
                .limit(pageSize)
            );
            const { data: fullRows, error: fullErr } = await full;
            if (fullErr) throw fullErr;
            if (fullRows) {
              setItems(fullRows as any);
              writeCache(fullRows as any);
            }
          }
        } else {
          // cold start / empty cache → full pull
          const full = await applyFilters(
            supabase
              .from('templates')
              .select(baseSelect)
              .order('updated_at', { ascending: false })
              .limit(pageSize)
          );
          const { data: fullRows, error: fullErr } = await full;
          if (fullErr) throw fullErr;
          setItems((fullRows || []) as any);
          writeCache((fullRows || []) as any);
        }
      } catch (e: any) {
        console.error('[useTemplatesList] load error', e);
        setError(e?.message || 'Failed to load templates');
      } finally {
        setLoading(false);
        running.current = false;
      }
    };

    void load();

    // refresh when tab regains focus
    const onFocus = () => {
      if (!running.current) void load();
    };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived, includeVersions, pageSize]);

  // convenience facets
  const liveOnly = useMemo(
    () => items.filter((t) => (includeVersions ? true : !t.is_version)),
    [items, includeVersions]
  );

  return { items, liveOnly, loading, error, refresh: () => {/* noop; auto on focus */} };
}
