'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { heroLog, heroDbgOn, pickHeroSnapshots } from '@/lib/debug/hero';

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

  /** Try to fetch server state that actually contains data.pages */
  const fetchStateWithData = useCallback(async (): Promise<any | null> => {
    if (!templateId) return null;

    const attempts = [
      `/api/templates/state2?id=${encodeURIComponent(templateId)}`,
      `/api/templates/state?id=${encodeURIComponent(templateId)}&full=1`,
      `/api/templates/state?id=${encodeURIComponent(templateId)}`,
    ];

    for (const url of attempts) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) continue;

        const data =
          json?.data ??
          json?.template?.data ??
          json?.infra?.data ??
          json?.state?.data ??
          null;

        if (data && Array.isArray(data?.pages)) return json;
      } catch {
        /* ignore and fall through */
      }
    }
    return null;
  }, [templateId]);

  /** helper: immediately hydrate editor from commit response */
  const mergeFromCommit = useCallback((json: any) => {
    try {
      if (json?.template) {
        window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: json.template }));
        if (heroDbgOn()) {
          heroLog('[commit] merged from response', {
            templateId,
            rev: json?.rev,
            keys: Object.keys(json.template || {}),
          });
        }
      } else {
        window.dispatchEvent(new Event('qs:template:invalidate'));
        if (heroDbgOn()) heroLog('[commit] no template in response; invalidated');
      }
    } catch {}
  }, [templateId]);

  /** Accept a full patch object (e.g., { data: {...} } or { color_mode, data }) */
  const _commitOnce = useCallback(
    async (patch: any, kind: 'save' | 'autosave') => {
      if (!templateId) return;
      if (!haveRevRef.current) await loadRev();
      const baseRev = revRef.current ?? 0;

      // --- DEBUG: about to send ---
      if (heroDbgOn()) {
        heroLog(`[commit] sending ${kind} (baseRev=${baseRev})`, {
          templateId,
          heroes: pickHeroSnapshots(patch?.data),
        });
      }

      const res = await fetch('/api/templates/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: templateId, baseRev, patch, kind }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (heroDbgOn()) {
          heroLog('[commit] error response', { status: res.status, json });
        }
        if (res.status === 409) {
          const serverRev = parseRev(json);
          if (serverRev) revRef.current = serverRev;
          throw new Error('merge_conflict');
        }
        throw new Error(json?.error || 'commit failed');
      }

      if (typeof json?.rev === 'number') revRef.current = json.rev;

      // ✅ Immediately hydrate from the authoritative row we just wrote
      mergeFromCommit(json);

      // --- DEBUG: fetch server state after commit (so we see what stuck) ---
      if (heroDbgOn()) {
        try {
          const stateJson = await fetchStateWithData();
          if (stateJson) {
            const data =
              stateJson?.data ??
              stateJson?.template?.data ??
              stateJson?.state?.data ??
              stateJson?.infra?.data ??
              {};
            const serverHeroes = pickHeroSnapshots(data);
            heroLog('[commit] server state hero snapshots', serverHeroes);
          } else {
            heroLog(
              '[commit] server state hero snapshots',
              '(no data.pages returned by /state endpoints)'
            );
          }
        } catch (e: any) {
          heroLog('[commit] server state fetch failed', { err: e?.message });
        }
      }

      return json;
    },
    [templateId, loadRev, fetchStateWithData, mergeFromCommit]
  );

  const commitPatch = useCallback(
    (patch: any, kind: 'save' | 'autosave' = 'autosave') => {
      if (!templateId) return Promise.resolve();

      // --- DEBUG: enqueueing a commit ---
      if (heroDbgOn()) {
        heroLog(`commitPatch enqueue (${kind})`, {
          templateId,
          heroes: pickHeroSnapshots(patch?.data),
        });
      }

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

      // --- DEBUG: schedule autosave with current payload snapshot ---
      if (heroDbgOn()) {
        heroLog('commitPatchSoon scheduled (autosave)', {
          templateId,
          heroes: pickHeroSnapshots(patch?.data),
        });
      }

      soonRef.current = setTimeout(async () => {
        if (!haveRevRef.current) await loadRev();
        void commitPatch(patch, 'autosave');
      }, 350);
    },
    [commitPatch, loadRev, templateId]
  );

  return { pending, commitPatch, commitPatchSoon, loadRev, revRef };
}
