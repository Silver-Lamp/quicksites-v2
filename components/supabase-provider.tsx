'use client';

import * as React from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type Ctx = { supabase: SupabaseClient<Database> };
const SupaCtx = React.createContext<Ctx | null>(null);

type SessionLike =
  | null
  | undefined
  | {
      access_token?: string;
      refresh_token?: string;
      [k: string]: any;
    };

export default function SupabaseProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: SessionLike;
}) {
  const [client] = React.useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // If SSR provided tokens, ensure the browser client is hydrated
      if (!initialSession?.access_token || !initialSession?.refresh_token) return;

      const { data: cur } = await client.auth.getSession();
      // Only seed if the browser has no session
      if (!cur.session) {
        await client.auth.setSession({
          access_token: initialSession.access_token!,
          refresh_token: initialSession.refresh_token!,
        });
      }
      if (cancelled) return;
    })();

    const { data: sub } = client.auth.onAuthStateChange(() => {
      // keep client hot; no-op needed
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client, initialSession?.access_token, initialSession?.refresh_token]);

  return <SupaCtx.Provider value={{ supabase: client }}>{children}</SupaCtx.Provider>;
}

export function useSupabase() {
  const ctx = React.useContext(SupaCtx);
  if (!ctx) throw new Error('useSupabase must be used within <SupabaseProvider>');
  return ctx;
}
