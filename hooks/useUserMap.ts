import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

import { useMemo } from 'react';

export function useUserMap() {
  const [userMap, setUserMap] = useState<Record<string, { name?: string }>>({});

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.from('user_profiles').select('user_id, name');
      if (error) {
        console.warn('Failed to load user profiles:', error.message);
        return;
      }

      const map = Object.fromEntries((data || []).map((user) => [user.user_id, { name: user.name ?? undefined }]));
      setUserMap(map);
    }

    fetchUsers();
  }, []);

  return useMemo(() => userMap, [userMap]);
}
