'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useSession() {
  const [user, setUser] = useState<null | { id: string; email: string; role: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        // Optionally fetch custom role from your own profile table
        setUser({ id: data.user.id, email: data.user.email!, role: 'admin' }); // hardcoded for now
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    getUser();
  }, []);

  return { user, loading };
}
