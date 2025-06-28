'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase/client'; // ✅ Use singleton
import type { Database } from '@/types/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

type SessionContextType = {
  user: {
    id: string;
    email: string;
    avatar_url?: string;
  } | null;
  role: string;
  supabase: SupabaseClient<Database>;
};

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within <SessionProvider>');
  return context;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionContextType['user'] | null>(null);
  const [role, setRole] = useState<string>('guest');

  async function refreshUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUser(null);
      setRole('guest');
      return;
    }

    setUser({
      id: user.id,
      email: user.email ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? '',
    });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    setRole(profile?.role || 'guest');
  }

  useEffect(() => {
    refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      console.log(`[🔄 Supabase Auth Event] ${event}`);
      refreshUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ user, role, supabase }}>
      {children}
    </SessionContext.Provider>
  );
}
