import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export function useCanonicalRole() {
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      setUser(currentUser);

      if (!currentUser) {
        setRole(null);
        setReady(true);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      setRole(profile?.role ?? 'viewer');
      setReady(true);
    };

    fetch();
  }, []);

  return { role, user, ready };
}
