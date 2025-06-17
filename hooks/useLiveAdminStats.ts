import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useLiveAdminStats() {
  const [unclaimed, setUnclaimed] = useState<number | null>(null);
  const [errors, setErrors] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { count: unclaimedCount } = await supabase
        .from('domains')
        .select('*', { count: 'exact', head: true })
        .eq('claimed', false);

      const { count: errorCount } = await supabase
        .from('user_action_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'error');

      setUnclaimed(unclaimedCount ?? 0);
      setErrors(errorCount ?? 0);
    };

    fetch();
    const interval = setInterval(fetch, 60_000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  return { unclaimed, errors };
}
