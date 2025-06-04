// hooks/useBrandingProfiles.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClientClient';

export function useBrandingProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('branding_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) setProfiles(data);
      setLoading(false);
    };

    fetchProfiles();
  }, []);

  return { profiles, loading };
}
