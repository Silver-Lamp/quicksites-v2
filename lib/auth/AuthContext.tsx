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
    email ? localStorage.getItem(`cached-role-${email}`) ?? 'viewer' : 'viewer';

  const cacheRole = (email: string, role: string) => {
    localStorage.setItem(`cached-role-${email}`, role);
  };

  const loadSession = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      setUser(null);
      setRole(null);
      setReady(true);
      return;
    }

    setUser(user);

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role) {
      setRole(profile.role);
      setRoleSource('profile');
      cacheRole(user.email ?? '', profile.role);
    } else {
      const fallbackRole = getCachedRole(user.email);
      setRole(fallbackRole);
      setRoleSource('cache');
    }

    setReady(true);
  };

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);

      if (u?.id) {
        supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', u.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.role) {
              setRole(data.role);
              setRoleSource('onAuthChange-profile');
              cacheRole(u.email ?? '', data.role);
            } else {
              const fallback = getCachedRole(u.email);
              setRole(fallback);
              setRoleSource('onAuthChange-cache');
            }
            setReady(true);
          });
      } else {
        setRole(null);
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, roleSource, ready, refetch: loadSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(AuthContext);
}
