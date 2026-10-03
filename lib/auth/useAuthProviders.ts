'use client';
// lib/auth/useAuthProviders.ts
//
// Client hook over GET /api/auth/providers for components that cannot await the server helper
// (the guest sign-up box lives inside the editor, a client tree). Starts CLOSED — Google off —
// and opens only when the route says so, so a slow or failed fetch never shows a button that
// would 400. The answer is memoised per page load; the route itself is edge-cached.
import { useEffect, useState } from 'react';
import type { AuthProviders } from '@/lib/auth/authProviders';

const CLOSED: AuthProviders = { google: false, email: true, source: 'unavailable' };

let cached: AuthProviders | null = null;
let inflight: Promise<AuthProviders> | null = null;

async function load(): Promise<AuthProviders> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch('/api/auth/providers', { cache: 'force-cache' })
      .then(async (r) => (r.ok ? ((await r.json()) as AuthProviders) : CLOSED))
      .catch(() => CLOSED)
      .then((p) => {
        cached = p;
        return p;
      });
  }
  return inflight;
}

export function useAuthProviders(): AuthProviders {
  const [providers, setProviders] = useState<AuthProviders>(cached ?? CLOSED);
  useEffect(() => {
    let alive = true;
    load().then((p) => {
      if (alive) setProviders(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return providers;
}
