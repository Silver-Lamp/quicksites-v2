'use client';

import { useCallback, useRef, useState } from 'react';
import type { Template } from '@/types/template';
import { templateSig } from '@/lib/editor/saveGuard';
import { dispatchTemplateCacheUpdate } from '@/lib/templateCache';

async function commitWithRebase({
  id,
  baseRev,
  patch,
  kind = 'save',
}: {
  id: string;
  baseRev: number | undefined;
  patch: Record<string, any>;
  kind?: 'save' | 'autosave';
}) {
  const send = async (rev: number) => {
    const res = await fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, baseRev: rev, patch, kind }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const latest = typeof json?.rev === 'number' ? json.rev : rev;
      return { conflict: true as const, latest };
    }
    if (!res.ok) throw new Error(json?.error || `commit failed (${res.status})`);
    // hydrate editor
    try {
      if (json?.template) {
        window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: json.template }));
      } else {
        window.dispatchEvent(new Event('qs:template:invalidate'));
      }
    } catch {}
    return { conflict: false as const, json };
  };

  const startRev = Number.isFinite(baseRev as number) ? (baseRev as number) : 0;
  const first = await send(startRev);
  if (first.conflict) {
    const second = await send(first.latest);
    if (!second.conflict) return second.json;
    throw new Error('commit rebase failed');
  }
  return (first as any).json;
}

export function useCommitQueue(tplRef: React.RefObject<Template>) {
  const committingRef = useRef(false);
  const queueRequestedRef = useRef(false);
  const [pending, setPending] = useState(false);

  const buildPatch = useCallback(() => {
    const cur: any = tplRef.current;
    const data = cur?.data ?? {};
    const out = { ...data };
    return { data: out, color_mode: cur?.color_mode, template_name: cur?.template_name };
  }, [tplRef]);

  const run = useCallback(async (kind: 'save'|'autosave'='save') => {
    if (committingRef.current) return;
    committingRef.current = true;
    setPending(true);
    try {
      do {
        queueRequestedRef.current = false;
        const cur: any = tplRef.current;
        const patch = buildPatch();
        await commitWithRebase({ id: cur.id, baseRev: cur.rev, patch, kind });

        // mark clean & cache
        const nextSig = templateSig({ ...cur, data: patch.data });
        (window as any).__qs_last_sig__ = nextSig;
        try { dispatchTemplateCacheUpdate(cur); } catch {}
      } while (queueRequestedRef.current);

      try { window.dispatchEvent(new Event('qs:preview:save')); } catch {}
    } catch (e) {
      console.error('[commit] failed', e);
    } finally {
      committingRef.current = false;
      setPending(false);
    }
  }, [tplRef, buildPatch]);

  const queueFullSave = useCallback((kind: 'save'|'autosave'='save') => {
    queueRequestedRef.current = true;
    if (!committingRef.current) void run(kind);
  }, [run]);

  return { queueFullSave, pending };
}
