// ✅ FILE: components/admin/context/CurrentUserProvider.tsx

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type CurrentUserContextType = {
  user: any | null;
  email: string | null;
  role: string | null;
  ready: boolean;
  hasRole: (r: string[]) => boolean;
};

export const CurrentUserContext = createContext<CurrentUserContextType>({
  user: null,
  email: null,
  role: null,
  ready: false,
  hasRole: () => false,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const u = session?.user;

      if (!u?.email) {
        setUser(null);
        setReady(true);
        return;
      }

      setUser(u);

      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_email', u.email)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const resolvedRole = roleData?.role || null;
      setRole(resolvedRole);
      setReady(true);

      console.log('✅ [Role loaded]', {
        source: 'CurrentUserProvider',
        role: resolvedRole,
        email: u.email,
      });
    };

    load();
  }, []);

  const hasRole = (roles: string[]) => {
    if (!role) return false;
    return roles.map(r => r.toLowerCase()).includes(role.toLowerCase());
  };

  return (
    <CurrentUserContext.Provider value={{ user, email: user?.email || null, role, ready, hasRole }}>
      {children}
    </CurrentUserContext.Provider>
  );
}
