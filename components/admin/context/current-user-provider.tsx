'use client';

import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { useSupabase } from '@/components/supabase-provider';

type State = { user: User | null; ready: boolean; isAdmin: boolean };
export const CurrentUserContext = React.createContext<State>({
  user: null,
  ready: false,
  isAdmin: false,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase();
  const [state, setState] = React.useState<State>({ user: null, ready: false, isAdmin: false });

  const computeIsAdmin = (u: User | null) => {
    const meta = (u?.app_metadata ?? {}) as any;
    if (meta?.isAdmin === true) return true;
    const roles: string[] | undefined = meta?.roles;
    return Array.isArray(roles) && roles.includes('admin');
  };

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Authoritative call to Supabase Auth
      const { data, error } = await supabase.auth.getUser();
      if (!cancelled && !error && data?.user) {
        const user = data.user;
        setState({ user, ready: true, isAdmin: computeIsAdmin(user) });
        return;
      }

      // 2) Fallback to server whoami (reads HttpOnly cookie on server)
      try {
        const res = await fetch('/api/auth/whoami', { cache: 'no-store' });
        const json = await res.json();
        const user = json?.user ?? null; // not a Supabase User, but truthy for gating
        if (!cancelled) setState({ user, ready: true, isAdmin: !!json?.isAdmin });
      } catch {
        if (!cancelled) setState({ user: null, ready: true, isAdmin: false });
      }
    })();

    // 3) Live updates
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const user = session?.user ?? null;
      setState({ user, ready: true, isAdmin: computeIsAdmin(user) });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <CurrentUserContext.Provider value={state}>
      {children}
    </CurrentUserContext.Provider>
  );
}
