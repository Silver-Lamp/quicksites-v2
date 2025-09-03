// hooks/useTemplateVersions.ts
'use client';

import * as React from 'react';

export type VersionRow = {
  /** Version id (if a tagged version) or snapshot id (fallback). */
  id: string;
  /** Optional human-friendly tag (e.g. v2025.09). */
  tag?: string | null;
  /** Underlying snapshot id, if available. */
  snapshot_id?: string | null;
  /** Commit/message or note. */
  commit?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiResponse = {
  // server may return versions, snapshots, or both
  versions?: any[];
  snapshots?: any[];
  // published references (any of these may exist)
  published_version_id?: string | null;
  published_snapshot_id?: string | null;
  published?: { version_id?: string | null; snapshot_id?: string | null } | null;
  // legacy fields (kept for compatibility)
  error?: string;
};

type IdInput =
  | string
  | {
      id?: string | null;
      canonical_id?: string | null;
      slug?: string | null;
    }
  | null
  | undefined;

function extractKey(input: IdInput): string {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  return (
    (input.canonical_id ?? input.id ?? input.slug ?? '').toString().trim()
  );
}

function pickCanonicalId(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  // Try a few likely shapes
  return (
    obj.canonical_id ??
    obj.canonicalId ??
    obj?.template?.canonical_id ??
    obj?.state?.canonical_id ??
    obj?.data?.canonical_id ??
    null
  );
}

export function useTemplateVersions(input: IdInput, currentId?: string | null) {
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [publishedVersionId, setPublishedVersionId] = React.useState<string | null>(null);
  const [publishedSnapshotId, setPublishedSnapshotId] = React.useState<string | null>(null);
  const [canonicalId, setCanonicalId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Prefer canonical_id if the caller passed an object with one.
  const preferredKey = extractKey(input);

  const normalize = (rows: any[]): VersionRow[] => {
    return (rows || []).map((r) => {
      const id: string = String(r.id ?? r.snapshot_id ?? '');
      return {
        id,
        tag: r.tag ?? r.label ?? null,
        snapshot_id: r.snapshot_id ?? null,
        commit: r.commit ?? r.note ?? r.message ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? r.created_at ?? null,
      } as VersionRow;
    });
  };

  const sortDesc = (rows: VersionRow[]) => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      return bt - at;
    });
    return copy;
  };

  const dedupe = (rows: VersionRow[]) => {
    const seen = new Set<string>();
    const out: VersionRow[] = [];
    for (const r of rows) {
      const k = `${r.tag ?? ''}::${r.snapshot_id ?? r.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  };

  const fetchVersions = React.useCallback(
    async (key: string, ac: AbortController) => {
      const r = await fetch(`/api/templates/${encodeURIComponent(key)}/versions`, {
        cache: 'no-store',
        signal: ac.signal,
      });
      const j: ApiResponse = await r.json().catch(() => ({}) as ApiResponse);
      return { res: r, json: j };
    },
    []
  );

  const resolveCanonicalAndRetry = React.useCallback(
    async (key: string, ac: AbortController) => {
      // Ask the state endpoint for the canonical id
      const s = await fetch(`/api/templates/state?id=${encodeURIComponent(key)}`, {
        cache: 'no-store',
        signal: ac.signal,
      });
      if (!s.ok) return { r: null as any, j: null as any };

      const stateJson = await s.json().catch(() => ({}));
      const canon = pickCanonicalId(stateJson);

      if (!canon || canon === key) return { r: null as any, j: null as any };

      // Retry versions with canonical id
      const { res, json } = await fetchVersions(canon, ac);
      if (res.ok) setCanonicalId(canon);
      return { r: res, j: json };
    },
    [fetchVersions]
  );

  const load = React.useCallback(async () => {
    const key = preferredKey;
    if (!key) {
      setVersions([]);
      setPublishedVersionId(null);
      setPublishedSnapshotId(null);
      setCanonicalId(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const ac = new AbortController();

    try {
      // First attempt with whatever the caller passed (may be a working/state id)
      let { res, json } = await fetchVersions(key, ac);

      // If server can’t resolve (e.g., "Canonical not found"), try to discover canonical_id and retry once.
      if (!res.ok && res.status === 404) {
        const { r, j } = await resolveCanonicalAndRetry(key, ac);
        if (r) {
          res = r;
          json = j;
        }
      }

      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      // Prefer server “versions”, fallback to “snapshots”
      let raw = (json.versions && json.versions.length ? json.versions : json.snapshots) ?? [];
      let rows = normalize(raw);

      // Optional: filter out current template row if server echoed it
      if (currentId) rows = rows.filter((v) => v.id !== currentId);

      rows = sortDesc(dedupe(rows));

      setVersions(rows);
      setPublishedVersionId(json.published_version_id ?? json.published?.version_id ?? null);
      setPublishedSnapshotId(json.published_snapshot_id ?? json.published?.snapshot_id ?? null);

      // If the server returned a canonical id anywhere, capture it (harmless if unchanged)
      if ((json as any)?.canonicalId || (json as any)?.canonical_id) {
        setCanonicalId((json as any)?.canonicalId ?? (json as any)?.canonical_id ?? null);
      } else if (!canonicalId && typeof input === 'object' && input?.canonical_id) {
        setCanonicalId(input.canonical_id ?? null);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
        setVersions([]);
        setPublishedVersionId(null);
        setPublishedSnapshotId(null);
      }
    } finally {
      setLoading(false);
    }

    // cleanup
    return () => ac.abort();
  }, [preferredKey, currentId, fetchVersions, resolveCanonicalAndRetry, canonicalId, input]);

  React.useEffect(() => {
    const cleanup: any = load();
    return () => {
      try {
        typeof cleanup === 'function' && cleanup();
      } catch {}
    };
  }, [load]);

  // Auto-refresh when the toolbar or other actors broadcast truth updates
  React.useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener('qs:truth:refresh', onRefresh as any);
    return () => window.removeEventListener('qs:truth:refresh', onRefresh as any);
  }, [load]);

  return {
    versions,
    publishedVersionId,
    publishedSnapshotId,
    canonicalId,
    loading,
    error,
    reloadVersions: load,
  };
}
