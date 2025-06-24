// hooks/useCurrentRole.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useCurrentRole() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setRole('viewer');
        return;
      }

      const email = user.email ?? '';
      const cacheKey = `cached-role-${email}`;
      let resolvedRole = localStorage.getItem(cacheKey) || 'viewer';

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.role) {
        resolvedRole = profile.role;
        localStorage.setItem(cacheKey, resolvedRole);
      }

      setRole(resolvedRole);
    };

    fetchRole();
  }, []);

  return role;
}
