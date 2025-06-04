// admin/hooks/useCurrentRole.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useCurrentRole() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      const userRole = user?.user_metadata?.role || 'viewer';
      setRole(userRole);
    });
  }, []);

  return role;
}
