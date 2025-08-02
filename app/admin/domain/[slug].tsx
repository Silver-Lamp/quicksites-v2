'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { supabase } from '@/admin/lib/supabaseClient';

type Domain = {
  id: number;
  domain: string;
  city?: string;
  is_claimed: boolean;
};

export default function DomainDetail() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get('slug') as string | null;
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(false);
  const { role } = useCanonicalRole();

  useEffect(() => {
    if (!slug) return;

    setLoading(true);

    supabase
      .from('domains')
      .select('*')
      .eq('domain', slug)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch domain:', error);
          setDomain(null);
        } else {
          setDomain(data);
        }
        setLoading(false);
      });
  }, [slug]);

  const toggleClaim = async () => {
    if (!domain) return;

    const newClaimed = !domain.is_claimed;

    const { error: updateError } = await supabase
      .from('domains')
      .update({ is_claimed: newClaimed })
      .eq('id', domain.id);

    if (updateError) {
      console.error('Failed to update claim status:', updateError);
      return;
    }

    const { error: logError } = await supabase.from('user_action_logs').insert([
      {
        domain_id: domain.id,
        action_type: 'site_claimed',
        triggered_by: role,
      },
    ]);

    if (logError) {
      console.error('Failed to log claim action:', logError);
    }

    setDomain({ ...domain, is_claimed: newClaimed });
  };

  if (loading) {
    return <p className="p-6 text-white" id="domain-detail-loading">Loading...</p>;
  }

  if (!domain) {
    return <p className="p-6 text-red-400">Domain not found.</p>;
  }

  return (
    <div className="p-6 text-white" id="domain-detail">
      <h1 className="text-2xl font-bold mb-4" id="domain-detail-domain">
        {domain.domain}
      </h1>
      <p id="domain-detail-city">City: {domain.city || 'Unknown'}</p>
      <p id="domain-detail-claimed">Claimed: {domain.is_claimed ? 'Yes' : 'No'}</p>
      {role === 'admin' && (
        <button
          onClick={toggleClaim}
          className="mt-4 bg-blue-600 px-4 py-2 rounded"
          id="domain-detail-toggle-claim"
        >
          Toggle Claim
        </button>
      )}
    </div>
  );
}
