// hooks/useTemplateVersions.ts
'use client';

import * as React from 'react';

export type VersionRow = {
  id: string;
  slug: string | null;
  commit: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_published: boolean;
  is_deployed: boolean;
};

type ApiResponse = {
  versions?: VersionRow[];
  published_version_id?: string | null;
  error?: string;
};

export function useTemplateVersions(idOrSlug: string | null | undefined, currentId?: string | null) {
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [publishedVersionId, setPublishedVersionId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const key = (idOrSlug ?? '').trim();

  const load = React.useCallback(async () => {
    if (!key) {
      setVersions([]);
      setPublishedVersionId(null);
      setError(null);
      return;
    }

    setLoading(true);
    const ac = new AbortController();

    try {
      const r = await fetch(`/api/templates/${encodeURIComponent(key)}/versions`, {
        cache: 'no-store',
        signal: ac.signal,
      });

      const j: ApiResponse = await r.json().catch(() => ({} as ApiResponse));

      if (!r.ok) {
        throw new Error(j?.error || `HTTP ${r.status}`);
      }

      let rows = (j.versions ?? []) as VersionRow[];
      if (currentId) rows = rows.filter((v) => v.id !== currentId);

      setVersions(rows);
      setPublishedVersionId(j.published_version_id ?? null);
      setError(null);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
        setVersions([]);
        setPublishedVersionId(null);
      }
    } finally {
      setLoading(false);
    }

    // cleanup
    return () => ac.abort();
  }, [key, currentId]);

  React.useEffect(() => {
    const cleanup: any = load();
    return () => {
      try {
        // if load returned an abort function, call it
        typeof cleanup === 'function' && cleanup();
      } catch {}
    };
  }, [load]);

  return { versions, publishedVersionId, loading, error, reloadVersions: load };
}
