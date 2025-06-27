// /hooks/useCurrentUser.tsx
import { useContext, useEffect, useState } from 'react';
import {
  CurrentUserContext,
  CurrentUserContextType,
} from '@/components/admin/context/current-user-provider';
import { supabase } from '@/admin/lib/supabaseClient';

export function useCurrentUser(): CurrentUserContextType & {
  role: string;
  roleSource: string;
  isLoading: boolean;
  ready: boolean;
} {
  const context = useContext(CurrentUserContext);

  const [fetchedRole, setFetchedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleSource, setRoleSource] = useState<'session' | 'db' | 'cache'>('session');

  useEffect(() => {
    const fetchRole = async () => {
      if (!context.user?.email) {
        setIsLoading(false);
        return;
      }

      const cacheKey = `cached-role-${context.user.email}`;

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
        .eq('user_email', context.user.email)
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
  }, [context.user?.email]);

  const role: string =
    (fetchedRole as 'viewer' | 'admin' | 'editor' | 'owner') ||
    context.user?.role ||
    'viewer';

  return {
    ...context,
    role: role as 'viewer' | 'admin' | 'editor' | 'owner',
    roleSource,
    isLoading,
    ready: !isLoading,
  };
}
