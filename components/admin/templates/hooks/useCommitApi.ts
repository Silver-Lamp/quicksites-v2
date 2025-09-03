'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useCommitApi(templateId?: string) {
  const [pending, setPending] = useState(false);
  const revRef = useRef<number>(0);
  const queue = useRef<Promise<any>>(Promise.resolve());
  const haveRevRef = useRef(false);

  const parseRev = (j: any): number => {
    const cand =
      j?.rev ??
      j?.infra?.template?.rev ??
      j?.state?.rev ??
      j?.template?.rev ??
      j?.data?.rev;
    return Number.isFinite(Number(cand)) ? Number(cand) : 0;
  };

  const loadRev = useCallback(async () => {
    if (!templateId) {
      revRef.current = 0;
      haveRevRef.current = true;
      return 0;
    }
    try {
      const res = await fetch(
        `/api/templates/state?id=${encodeURIComponent(templateId)}`,
        { cache: 'no-store' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'state failed');
      const r = parseRev(json);
      revRef.current = r;
      haveRevRef.current = true;
      return r;
    } catch {
      revRef.current = 0;
      haveRevRef.current = true;
      return 0;
    }
  }, [templateId]);

  useEffect(() => {
    void loadRev();
  }, [loadRev]);

  /** Accept a full patch object (e.g., { data: {...} } or { color_mode, data }) */
  const _commitOnce = useCallback(
    async (patch: any, kind: 'save' | 'autosave') => {
      if (!templateId) return;
      if (!haveRevRef.current) await loadRev();
      const baseRev = revRef.current ?? 0;

      const res = await fetch('/api/templates/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: templateId, baseRev, patch, kind }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          const serverRev = parseRev(json);
          if (serverRev) revRef.current = serverRev;
          throw new Error('merge_conflict');
        }
        throw new Error(json?.error || 'commit failed');
      }
      if (typeof json?.rev === 'number') revRef.current = json.rev;
      return json;
    },
    [templateId, loadRev]
  );

  const commitPatch = useCallback(
    (patch: any, kind: 'save' | 'autosave' = 'autosave') => {
      if (!templateId) return Promise.resolve();
      queue.current = queue.current.then(async () => {
        setPending(true);
        try {
          try {
            return await _commitOnce(patch, kind);
          } catch (e: any) {
            if (e?.message === 'merge_conflict') {
              await loadRev();
              return await _commitOnce(patch, kind);
            }
            throw e;
          }
        } finally {
          setPending(false);
          try {
            window.dispatchEvent(new CustomEvent('qs:truth:refresh'));
          } catch {}
        }
      });
      return queue.current;
    },
    [_commitOnce, loadRev, templateId]
  );

  const soonRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitPatchSoon = useCallback(
    (patch: any) => {
      if (soonRef.current) clearTimeout(soonRef.current);
      soonRef.current = setTimeout(async () => {
        if (!haveRevRef.current) await loadRev();
        void commitPatch(patch, 'autosave');
      }, 350);
    },
    [commitPatch, loadRev]
  );

  return { pending, commitPatch, commitPatchSoon, loadRev, revRef };
}
