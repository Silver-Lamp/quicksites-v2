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

export function useTemplateVersions(
  idOrSlug: string | null | undefined,
  currentId?: string | null
) {
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [publishedVersionId, setPublishedVersionId] = React.useState<string | null>(null);
  const [publishedSnapshotId, setPublishedSnapshotId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const key = (idOrSlug ?? '').trim();

  const normalize = (rows: any[]): VersionRow[] => {
    return (rows || []).map((r) => {
      // Support both “version rows” and plain snapshot rows.
      // Prefer explicit snapshot_id if present; otherwise id may already be a snapshot id.
      const id: string = String(r.id ?? r.snapshot_id ?? '');
      return {
        id,
        tag: r.tag ?? null,
        snapshot_id: r.snapshot_id ?? null,
        commit: r.commit ?? r.note ?? null,
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

  const load = React.useCallback(async () => {
    if (!key) {
      setVersions([]);
      setPublishedVersionId(null);
      setPublishedSnapshotId(null);
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

      const j: ApiResponse = await r.json().catch(() => ({}) as ApiResponse);
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      // Prefer server “versions” list, fallback to “snapshots”
      let raw = (j.versions && j.versions.length ? j.versions : j.snapshots) ?? [];
      let rows = normalize(raw);

      // Optional: filter out current template row if server echoed it
      if (currentId) rows = rows.filter((v) => v.id !== currentId);

      rows = sortDesc(dedupe(rows));

      setVersions(rows);
      setPublishedVersionId(
        j.published_version_id ?? j.published?.version_id ?? null
      );
      setPublishedSnapshotId(
        j.published_snapshot_id ?? j.published?.snapshot_id ?? null
      );
      setError(null);
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
  }, [key, currentId]);

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
    const onRefresh = () => { void load(); };
    window.addEventListener('qs:truth:refresh', onRefresh as any);
    return () => window.removeEventListener('qs:truth:refresh', onRefresh as any);
  }, [load]);

  return {
    versions,
    publishedVersionId,
    publishedSnapshotId,
    loading,
    error,
    reloadVersions: load,
  };
}
