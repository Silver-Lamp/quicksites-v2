import { useEffect, useState } from 'react';
import { LeadSummary, loadLeads, getTopTwoLeads } from '@/lib/loadLeads.js';

type UseLeadsOptions = {
  city?: string;
  state?: string;
  industry?: string;
  autoPickTopTwo?: boolean;
};

export function useLeads({
  city,
  state,
  industry = 'towing',
  autoPickTopTwo = true,
}: UseLeadsOptions) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [lead1, setLead1] = useState<string>('');
  const [lead2, setLead2] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const options = {
          city,
          state,
          industry,
          sortBy: 'created_at' as const,
          sortOrder: 'desc' as const,
        };

        const loaded = await loadLeads(options);
        setLeads(loaded);

        if (autoPickTopTwo) {
          const topTwo = await getTopTwoLeads(options);
          if (topTwo) {
            setLead1(topTwo[0].id);
            setLead2(topTwo[1].id);
          }
        }
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('Unexpected error');
      } finally {
        setLoading(false);
      }
    };

    if (city || state) fetchLeads();
  }, [city, state, industry, autoPickTopTwo]);

  return {
    leads,
    lead1,
    lead2,
    setLead1,
    setLead2,
    loading,
    error,
  };
}
