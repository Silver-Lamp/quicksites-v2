import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export function useLiveDraftStats() {
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');

      setDraftCount(count ?? 0);
    };

    fetch();
  }, []);

  return { draftCount };
}
