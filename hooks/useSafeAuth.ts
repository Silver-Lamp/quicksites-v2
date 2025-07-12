// hooks/useSafeAuth.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { SafeUser } from '@/types/safe-user';

type SafeAuth = {
  user: SafeUser | null;
  role: string;
  isLoggedIn: boolean;
  ip?: string;
  userAgent?: string;
};

export function useSafeAuth(): SafeAuth {
  const [auth, setAuth] = useState<SafeAuth>({
    user: null,
    role: 'guest',
    isLoggedIn: false,
    ip: undefined,
    userAgent: undefined,
  });

  useEffect(() => {
    const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const readFromBody = () => {
      if (typeof window === 'undefined') return null;
      const body = document?.body?.dataset;
      const id = body?.userId ?? '';
      const email = body?.userEmail ?? '';
      const role = body?.userRole ?? 'guest';
      const avatar_url = body?.userAvatarUrl ?? '';
      const name = body?.userName ?? '';

      if (!id || !email) return null;

      return {
        user: {
          id,
          email,
          avatar_url,
          name,
        },
        role,
        isLoggedIn: true,
      };
    };

    const init = async () => {
      const headerInfo = readFromBody();

      if (headerInfo) {
        setAuth({
          ...headerInfo,
          ip: undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        });
        return;
      }

      // 🧱 Fallback: try Supabase if headers not available
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.warn('[useSafeAuth] Supabase auth error:', error.message);
      }

      setAuth({
        user: user
          ? {
              id: user.id,
              email: user.email ?? '',
              avatar_url: user.user_metadata?.avatar_url ?? '',
              name: user.user_metadata?.name ?? '',
            }
          : null,
        role: user?.user_metadata?.role ?? 'guest',
        isLoggedIn: !!user,
        ip: undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
    };

    init();
  }, []);

  return auth;
}
