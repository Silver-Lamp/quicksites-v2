// ✅ FILE: hooks/useCurrentUser.tsx

import { useContext, useEffect, useState } from 'react';
import { CurrentUserContextType } from '../components/admin/context/CurrentUserProvider.jsx';
import { CurrentUserContext } from '../components/admin/context/CurrentUserProvider.jsx';
import { supabase } from '@/lib/supabase';

export function useCurrentUser(): CurrentUserContextType & {
  roleSource: string;
  isLoading: boolean;
} {
  const context = useContext(CurrentUserContext);

  const [fetchedRole, setFetchedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleSource, setRoleSource] = useState<'session' | 'db' | 'cache'>(
    'session'
  );

  useEffect(() => {
    const fetchRole = async () => {
      if (!context.email) return;

      const cacheKey = `cached-role-${context.email}`;

      // Check localStorage first
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.debug('📦 Using cached fallback role:', cached);
        setFetchedRole(cached);
        setRoleSource('cache');
        setIsLoading(false);
        return;
      }

      // Otherwise query Supabase
      const { data, error } = await supabase
        .from('user_roles')
        .select('new_role')
        .eq('user_email', context.email)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.warn('🔍 Role fetch error', error.message);
      } else if (data?.new_role?.trim()) {
        console.debug('✅ Fallback role from DB:', data.new_role);
        setFetchedRole(data.new_role);
        setRoleSource('db');
        localStorage.setItem(cacheKey, data.new_role);
      }

      setIsLoading(false);
    };

    fetchRole();
  }, [context.email]);

  return {
    ...context,
    role: fetchedRole || context.role,
    isLoading,
    roleSource,
  };
}
