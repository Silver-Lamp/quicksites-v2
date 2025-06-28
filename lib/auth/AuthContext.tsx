'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import type { User } from '@supabase/supabase-js';
import React from 'react';

type AuthState = {
  user: User | null;
  role: string | null;
  ready: boolean;
  roleSource: 'profile' | 'cache' | 'onAuthChange-profile' | 'onAuthChange-cache' | 'init';
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
  const [roleSource, setRoleSource] = useState<AuthState['roleSource']>('init');
  const [ready, setReady] = useState(false);

  const getCachedRole = (email: string | null | undefined): string => {
    if (!email) return 'viewer';
    return localStorage.getItem(`cached-role-${email}`) ?? 'viewer';
  };

  const cacheRole = (email: string | null | undefined, role: string) => {
    if (email) localStorage.setItem(`cached-role-${email}`, role);
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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role) {
      setRole(profile.role);
      setRoleSource('profile');
      cacheRole(user.email, profile.role);
    } else {
      const fallback = getCachedRole(user.email);
      setRole(fallback);
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
              cacheRole(u.email, data.role);
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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, ready, roleSource, refetch: loadSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(AuthContext);
}
