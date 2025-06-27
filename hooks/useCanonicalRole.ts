// /hooks/useCanonicalRole.ts
import { useEffect, useState } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { supabase } from '@/admin/lib/supabaseClient';

export function useCanonicalRole() {
  const { user, ready } = useCurrentUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      console.log('[🔁 useCanonicalRole] Waiting for auth context to be ready...');
      return;
    }

    if (!user?.id) {
      console.warn('[❌ useCanonicalRole] No user found');
      return;
    }

    console.log('[🧠 useCanonicalRole] Fetching role for user:', user.email);

    supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[❌ useCanonicalRole] Failed to fetch profile:', error.message);
        } else {
          console.log('[✅ useCanonicalRole] Fetched profile:', data);
          setRole(data?.role ?? 'viewer');
        }
      });
  }, [user, ready]);

  return { role, ready };
}
