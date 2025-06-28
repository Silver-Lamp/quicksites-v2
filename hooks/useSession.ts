'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type SessionUser = {
  id: string;
  email: string;
  role: string;
};

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { id, email } = authData.user;

      // Optional: fetch role from `user_profiles` table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', id)
        .maybeSingle();

      const role = profile?.role || 'viewer';

      setUser({ id, email: email ?? '', role });
      setLoading(false);
    };

    getUser();
  }, []);

  return { user, loading };
}
