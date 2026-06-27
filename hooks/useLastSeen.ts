'use client';

import { useEffect } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function useLastSeen() {
  useEffect(() => {
    const update = async () => {
      // update_last_seen RPC not in live DB — cast to any (was failing silently); see types migration
      await (supabase as any).rpc('update_last_seen');
    };

    update();
  }, []);
}
