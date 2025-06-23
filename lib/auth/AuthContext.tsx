'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  role: string | null;
  ready: boolean;
  roleSource: string;
  refetch: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  ready: false,
  roleSource: 'init',
  refetch: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleSource, setRoleSource] = useState('init');
  const [ready, setReady] = useState(false);

  const getCachedRole = (email: string | undefined | null) =>
    email ? (localStorage.getItem(`cached-role-${email}`) ?? 'viewer') : 'viewer';

  const cacheRole = (email: string, role: string) => {
    localStorage.setItem(`cached-role-${email}`, role);
  };

  const loadSession = async () => {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user ?? null;

    setUser(u);
    setRole(u?.user_metadata?.role ?? getCachedRole(u?.email));
    setRoleSource('loadSession');
    setReady(true);
  };

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setRole(u?.user_metadata?.role ?? getCachedRole(u?.email));
      setRoleSource('onAuthChange');
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email && role) cacheRole(user.email, role);
  }, [user, role]);

  return (
    <AuthContext.Provider value={{ user, role, roleSource, ready, refetch: loadSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(AuthContext);
}
