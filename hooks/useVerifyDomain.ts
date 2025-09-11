// hooks/useVerifyDomain.ts
'use client';

import { useEffect, useRef, useState } from 'react';

type Options = {
  enabled?: boolean;          // start immediately
  intervalMs?: number;        // poll interval
  maxAttempts?: number;       // stop after N tries
  onVerified?: () => void;    // callback once
};

type State = 'idle' | 'verifying' | 'verified' | 'error';

export function useVerifyDomain(domain: string | null, opts: Options = {}) {
  const { enabled = true, intervalMs = 10_000, maxAttempts = 12, onVerified } = opts;
  const [status, setStatus] = useState<State>('idle');
  const [verified, setVerified] = useState(false);
  const attemptsRef = useRef(0);
  const stopRef = useRef(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!domain || !enabled) {
      setStatus('idle');
      setVerified(false);
      attemptsRef.current = 0;
      return;
    }

    stopRef.current = false;
    setStatus('verifying');
    setVerified(false);
    attemptsRef.current = 0;

    const controller = new AbortController();

    async function tick() {
      if (stopRef.current) return;
      attemptsRef.current += 1;

      try {
        const res = await fetch('/api/domains/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) throw new Error('Verify HTTP error');
        const json = await res.json();

        if (json?.verified) {
          setVerified(true);
          setStatus('verified');
          if (!firedRef.current && onVerified) {
            firedRef.current = true;
            try { onVerified(); } catch {}
          }
          return; // stop polling
        }
      } catch {
        // swallow; we’ll retry below
      }

      if (attemptsRef.current < maxAttempts) {
        setTimeout(tick, intervalMs);
      } else {
        setStatus('error');
      }
    }

    tick();

    return () => {
      stopRef.current = true;
      controller.abort();
    };
  }, [domain, enabled, intervalMs, maxAttempts, onVerified]);

  return { status, verified };
}
