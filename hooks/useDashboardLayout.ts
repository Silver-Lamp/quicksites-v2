import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_LAYOUT = [
  { id: 'activity', title: 'Activity' },
  { id: 'engagement', title: 'Engagement' },
  { id: 'retention', title: 'Retention' }
];

export function useDashboardLayout(role = 'user') {
  const [order, setOrder] = useState(DEFAULT_LAYOUT);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const localOrder = localStorage.getItem('dashboard-order');
    const localHidden = localStorage.getItem('dashboard-hidden');

    if (localOrder) setOrder(JSON.parse(localOrder));
    if (localHidden) setHidden(JSON.parse(localHidden));

    (async () => {
      const { data } = await supabase
        .from('dashboard_layouts')
        .select('layout, hidden')
        .eq('role', role)
        .single();

      if (data?.layout) {
        setOrder(data.layout);
        localStorage.setItem('dashboard-order', JSON.stringify(data.layout));
      }
      if (data?.hidden) {
        setHidden(data.hidden);
        localStorage.setItem('dashboard-hidden', JSON.stringify(data.hidden));
      }

      setLoaded(true);
    })();
  }, [role]);

  return { order, hidden, loaded };
}
