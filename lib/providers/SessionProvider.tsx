// lib/providers/SessionProvider.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type SessionUser = { id: string; email: string; avatar_url?: string };
type SessionContextType = {
  user: SessionUser | null;
  role: string; // 'admin' | 'viewer' | etc.
  supabase: SupabaseClient<Database>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<string>('guest');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/whoami', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('whoami failed');
      const data = await res.json();
      if (data?.userPresent && data.user) {
        setUser({ id: data.user.id, email: data.user.email });
        // prefer role from API if present; otherwise infer from isAdmin
        setRole(data.role ?? (data.isAdmin ? 'admin' : 'viewer'));
      } else {
        setUser(null);
        setRole('guest');
      }
    } catch {
      setUser(null);
      setRole('guest');
    }
  }, []);

  useEffect(() => {
    // initial fetch
    refresh();
  }, [refresh]);

  // optional: refresh on focus/visibility (helps after auth redirects)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  return (
    <SessionContext.Provider
      value={{ user, role, supabase: supabase as SupabaseClient<Database>, refresh }}
    >
      {children}
    </SessionContext.Provider>
  );
}
