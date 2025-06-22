'use client';

import { useEffect } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function useLastSeen() {
  useEffect(() => {
    const update = async () => {
      await supabase.rpc('update_last_seen');
    };

    update();
  }, []);
}
