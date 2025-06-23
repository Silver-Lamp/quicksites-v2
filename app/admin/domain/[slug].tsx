import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

export default function DomainDetail() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get('slug') as string;
  const [domain, setDomain] = useState<any>(null);
  const [role, setRole] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userRole = data?.user?.user_metadata?.role || '';
      setRole(userRole);
    });

    if (!slug) return;
    supabase
      .from('domains')
      .select('*')
      .eq('domain', slug)
      .single()
      .then(({ data }) => setDomain(data));
  }, [slug]);

  const toggleClaim = async () => {
    if (!domain) return;
    await supabase.from('domains').update({ is_claimed: !domain.is_claimed }).eq('id', domain.id);

    await supabase.from('user_action_logs').insert([
      {
        domain_id: domain.id,
        action_type: 'site_claimed',
        triggered_by: role,
      },
    ]);

    setDomain({ ...domain, is_claimed: !domain.is_claimed });
  };

  return domain ? (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">{domain.domain}</h1>
      <p>City: {domain.city}</p>
      <p>Claimed: {domain.is_claimed ? 'Yes' : 'No'}</p>
      {role === 'admin' && (
        <button onClick={toggleClaim} className="mt-4 bg-blue-600 px-4 py-2 rounded">
          Toggle Claim
        </button>
      )}
    </div>
  ) : (
    <p className="p-6 text-white">Loading...</p>
  );
}
