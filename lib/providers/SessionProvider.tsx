'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

type SessionContextType = {
  user: {
    id: string;
    email: string;
    avatar_url?: string;
  } | null;
  role: string;
  supabase: ReturnType<typeof createBrowserClient<Database>>;
};

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within <SessionProvider>');
  return context;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
    // Initial load
    refreshUser();

    // Listen for sign-in/out/session-change events
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
