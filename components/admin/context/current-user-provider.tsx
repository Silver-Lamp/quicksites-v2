'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

import { getSupabase } from '@/lib/supabase/server';

type CurrentUser = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: string;
  bio?: string;
  plan?: string;
};

export type CurrentUserContextType = {
  user: CurrentUser | null;
  ready: boolean;
  role: 'admin' | 'editor' | 'viewer' | 'owner';
  hasRole: (roles: string[]) => boolean;
  refetch: () => void;
};

export const CurrentUserContext = createContext<CurrentUserContextType>({
  user: null,
  ready: false,
  role: 'viewer',
  hasRole: () => false,
  refetch: () => {},
});

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData?.session?.user;

    if (!u?.id) {
      setUser(null);
      setReady(true);
      return;
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', u.id)
      .single();

    if (error) {
      console.error('❌ Failed to fetch user_profiles:', error.message);
      setUser(null);
      setReady(true);
      return;
    }

    const normalizedRole = (profile.role || 'viewer').toLowerCase() as CurrentUser['role'];

    const user: CurrentUser = {
      id: u.id,
      email: u.email ?? profile.email,
      name: profile.name ?? '',
      avatar_url: profile.avatar_url ?? '',
      role: normalizedRole,
      bio: profile.bio ?? '',
      plan: profile.plan ?? 'free',
    };

    console.log('✅ [User loaded]', {
      email: user.email,
      role: user.role,
      plan: user.plan,
    });

    setUser(user);
    setReady(true);
  };

  useEffect(() => {
    load();
  }, []);

  const hasRole = (roles: string[]) =>
    user?.role ? roles.map((r) => r.toLowerCase()).includes(user.role.toLowerCase()) : false;

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        ready,
        role: (user?.role as 'admin' | 'editor' | 'viewer' | 'owner') || 'viewer',
        hasRole,
        refetch: load,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}
