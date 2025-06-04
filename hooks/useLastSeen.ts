'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function useLastSeen() {
  useEffect(() => {
    const update = async () => {
      await supabase.rpc('update_last_seen');
    };

    update();
  }, []);
}
