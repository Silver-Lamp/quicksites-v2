import { useEffect } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export function useRealtimeLayout(profileId: string, onUpdate: (layout: any[]) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`branding:layout:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branding_profiles',
          filter: `id=eq.${profileId}`,
        },
        (payload) => {
          const newLayout = payload.new.layout;
          if (newLayout) onUpdate(newLayout);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, onUpdate]);
}
