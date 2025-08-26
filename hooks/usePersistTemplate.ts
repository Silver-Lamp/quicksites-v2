'use client';

import * as React from 'react';
import type { Template } from '@/types/template';

type Options = {
  /** Debounce window for persistSoon (ms). Default: 400 */
  debounceMs?: number;
  /** Called when the server returns ok */
  onSuccess?: (payload: { ok: boolean; template?: any } | unknown) => void;
  /** Called when a request fails */
  onError?: (err: Error) => void;
  /** Optional fetch init overrides (headers etc.) */
  fetchInit?: RequestInit;
};

/**
 * Persist the current Template to /api/templates/:id/edit.
 *
 * Pass a getter that always returns the latest Template (e.g. a ref.current),
 * or pass a "next" Template directly to persist()/persistSoon().
 */
export function usePersistTemplate(
  id: string | undefined | null,
  getCurrent: () => Template,
  opts: Options = {}
) {
  const { debounceMs = 400, onSuccess, onError, fetchInit } = opts;

  const [pending, setPending] = React.useState(false);
  const [lastError, setLastError] = React.useState<Error | null>(null);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const persist = React.useCallback(
    async (next?: Template) => {
      if (!id) {
        const e = new Error('Missing template id for persist');
        setLastError(e);
        onError?.(e);
        return false;
      }

      // cancel any in-flight request
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      // start from latest template
      let payload: Template = next ?? getCurrent();

      // --- client-side guardrails for RLS / first save ---
      try {
        // 1) Ensure owner_id so returning SELECT sees the row under RLS
        if (!(payload as any).owner_id) {
          const who = await fetch('/api/auth/whoami', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
          const uid = who?.user?.id ?? who?.id ?? who?.user_id;
          if (uid) payload = { ...payload, owner_id: uid } as Template;
        }
        // 2) Don't try to mark new records verified=true on create
        if ((payload as any).verified === true) {
          payload = { ...(payload as any), verified: false } as Template;
        }
        // 3) Keep URL id authoritative
        if ((payload as any).id && String((payload as any).id) !== String(id)) {
          payload = { ...(payload as any), id } as Template;
        }
      } catch {
        // non-fatal; server route still handles normalization
      }

      try {
        setPending(true);
        setLastError(null);

        const init: RequestInit = {
          method: 'POST',
          ...fetchInit, // allow user overrides, but we re-apply critical fields below
          headers: { 'content-type': 'application/json', ...(fetchInit?.headers ?? {}) },
          body: JSON.stringify({ template: payload }),
          signal: ac.signal, // ensure our abort signal wins
        };

        const res = await fetch(`/api/templates/${encodeURIComponent(id)}/edit`, init);

        // best-effort response parsing
        let json: any = undefined;
        let text: string | undefined;
        try {
          json = await res.json();
        } catch {
          try { text = await res.text(); } catch {}
        }

        if (!res.ok) {
          const err = new Error(json?.error || text || `Save failed (${res.status})`);
          setLastError(err);
          onError?.(err);
          return false;
        }

        onSuccess?.(json ?? { ok: true });
        return true;
      } catch (e: any) {
        if (e?.name === 'AbortError') return false;
        const err = e instanceof Error ? e : new Error(String(e));
        setLastError(err);
        onError?.(err);
        return false;
      } finally {
        setPending(false);
      }
    },
    [id, getCurrent, onError, onSuccess, fetchInit]
  );

  const persistSoon = React.useCallback(
    (next?: Template) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void persist(next); }, debounceMs);
    },
    [debounceMs, persist]
  );

  // cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { persist, persistSoon, pending, lastError };
}

/**
 * Convenience: keep a ref in sync with the latest template
 * so persist() always reads the freshest value.
 */
export function useTemplateRef<T extends Template>(tpl: T) {
  const ref = React.useRef<T>(tpl);
  React.useEffect(() => { ref.current = tpl; }, [tpl]);
  return ref;
}
