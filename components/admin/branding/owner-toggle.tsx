'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

type OwnerToggleProps = {
  profileId: string;
};

export default function OwnerToggle({ profileId }: OwnerToggleProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  const assignToMe = async () => {
    if (!userId || loading) return;
    setLoading(true);
    await supabase
      .from('branding_profiles')
      .update({ owner_id: userId })
      .eq('id', profileId);
    location.reload();
  };

  return (
    <button
      onClick={assignToMe}
      disabled={loading}
      aria-label="Assign ownership of this branding profile to current user"
      className={`mt-2 text-xs underline ${
        loading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600'
      }`}
    >
      {loading ? 'Assigning…' : 'Assign to Me'}
    </button>
  );
}
