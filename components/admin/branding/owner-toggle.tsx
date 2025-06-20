import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function OwnerToggle({ profileId }: { profileId: string }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const assignToMe = async () => {
    if (!userId) return;
    await supabase.from('branding_profiles').update({ owner_id: userId }).eq('id', profileId);
    location.reload();
  };

  return (
    <button className="mt-2 text-xs underline text-blue-600" onClick={assignToMe}>
      Assign to Me
    </button>
  );
}
