import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

import { useMemo } from 'react';

export function useUserMap() {
  const [userMap, setUserMap] = useState<Record<string, { name?: string }>>({});

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.from('profiles').select('id, name');
      if (error) {
        console.warn('Failed to load user profiles:', error.message);
        return;
      }

      const map = Object.fromEntries(
        (data || []).map(user => [user.id, { name: user.name }])
      );
      setUserMap(map);
    }

    fetchUsers();
  }, []);

  return useMemo(() => userMap, [userMap]);
}
