// lib/providers/SessionProvider.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type SessionUser = { id: string; email: string; avatar_url?: string };
type SessionContextType = {
  user: SessionUser | null;
  role: string;
  supabase: SupabaseClient<Database>;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
};

const SessionContext = createContext<SessionContextType | null>(null);
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

/* ---------- cache helpers ---------- */
const SESSION_CACHE_KEY = 'qs:session:v1';
const SESSION_TTL_MS = 5 * 60_000; // 5 minutes

type SessionCache = { user: SessionUser | null; role: string; t: number };

const safeLS = {
  get<T = any>(k: string): T | null {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: any) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      // ignore QuotaExceededError / private mode
    }
  },
  remove(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

export function SessionProvider({ children }: { children: ReactNode }) {
  // hydrate from cache synchronously to avoid UI flip
  const initial = (() => {
    if (typeof window === 'undefined') return { user: null, role: 'guest' };
    const c = safeLS.get<SessionCache>(SESSION_CACHE_KEY);
    if (c && Date.now() - c.t < SESSION_TTL_MS) return { user: c.user, role: c.role };
    return { user: null, role: 'guest' };
  })();

  const [user, setUser] = useState<SessionUser | null>(initial.user);
  const [role, setRole] = useState<string>(initial.role);

  // single-flight refresh + simple throttle
  const inFlight = useRef<Promise<void> | null>(null);
  const lastRefresh = useRef(0);

  const writeCache = useCallback((u: SessionUser | null, r: string) => {
    safeLS.set(SESSION_CACHE_KEY, { user: u, role: r, t: Date.now() } as SessionCache);
  }, []);

  const setSession = useCallback((u: SessionUser | null, r: string) => {
    setUser(u);
    setRole(r);
    writeCache(u, r);
  }, [writeCache]);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (!opts?.force && inFlight.current) return inFlight.current;
    const now = Date.now();
    if (!opts?.force && now - lastRefresh.current < 1500 && inFlight.current) return inFlight.current;

    inFlight.current = (async () => {
      try {
        const res = await fetch('/api/auth/whoami', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('whoami failed');
        const data = await res.json();

        if (data?.userPresent && data.user) {
          const u: SessionUser = {
            id: data.user.id,
            email: data.user.email,
            avatar_url: data.user.avatar_url ?? undefined,
          };
          const r: string = data.role ?? (data.isAdmin ? 'admin' : 'viewer');
          setSession(u, r);
        } else {
          setSession(null, 'guest');
        }
      } catch {
        // keep whatever we had (cached) on error
        if (!safeLS.get(SESSION_CACHE_KEY)) setSession(null, 'guest');
      } finally {
        lastRefresh.current = Date.now();
        inFlight.current = null;
      }
    })();

    return inFlight.current;
  }, [setSession]);

  /* Initial refresh:
     - If cache is fresh, render instantly and refresh in background after a short tick.
     - If cache is stale/empty, refresh immediately. */
  useEffect(() => {
    const cached = safeLS.get<SessionCache>(SESSION_CACHE_KEY);
    const fresh = cached && Date.now() - cached.t < SESSION_TTL_MS;
    if (fresh) {
      const t = setTimeout(() => void refresh(), 50);
      return () => clearTimeout(t);
    } else {
      void refresh();
    }
  }, [refresh]);

  // Refresh on focus/visibility (throttled by refresh single-flight)
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  // Cross-tab sync via storage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_CACHE_KEY || !e.newValue) return;
      try {
        const c = JSON.parse(e.newValue) as SessionCache;
        setUser(c.user);
        setRole(c.role);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Supabase auth events → force refresh (sign-in/out in any tab)
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        safeLS.remove(SESSION_CACHE_KEY);
        setSession(null, 'guest');
      } else {
        void refresh({ force: true });
      }
    });
    return () => sub.data.subscription.unsubscribe();
  }, [refresh, setSession]);

  return (
    <SessionContext.Provider
      value={{ user, role, supabase: supabase as SupabaseClient<Database>, refresh }}
    >
      {children}
    </SessionContext.Provider>
  );
}
