// /hooks/useCurrentUser.tsx (enhanced with mock support and role helpers)
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
  isAdmin: boolean;
  isOwner: boolean;
  isReseller: boolean;
  isViewer: boolean;
  isMocked: boolean;
} {
  const context = useContext(CurrentUserContext);

  const [fetchedRole, setFetchedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleSource, setRoleSource] = useState<'simulated' | 'session' | 'db' | 'cache'>('session');
  const [mockUser, setMockUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const devMockRole = typeof window !== 'undefined' ? (window as any).__DEV_MOCK_ROLE__ : null;
      const devMockUser = typeof window !== 'undefined' ? (window as any).__DEV_MOCK_USER__ : null;
      if (devMockRole && devMockUser) {
        setFetchedRole(devMockRole);
        setRoleSource('simulated');
        setMockUser(devMockUser);
        setIsLoading(false);
        return;
      }

      const email = context.user?.email;
      if (!email) {
        setIsLoading(false);
        return;
      }

      const cacheKey = `cached-role-${email}`;

      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.debug('📦 Using cached fallback role:', cached);
        setFetchedRole(cached);
        setRoleSource('cache');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('new_role')
        .eq('user_email', email)
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
    (fetchedRole as 'viewer' | 'admin' | 'editor' | 'owner' | 'reseller') ||
    context.user?.role ||
    'viewer';

  const isMocked = roleSource === 'simulated';

  return {
    ...context,
    user: isMocked && mockUser ? { ...mockUser } : context.user,
    role: role as 'viewer' | 'admin' | 'editor' | 'owner' | 'reseller',
    roleSource,
    isLoading,
    ready: !isLoading,
    isMocked,
    isAdmin: role === 'admin',
    isOwner: role === 'owner',
    isReseller: role === 'reseller',
    isViewer: role === 'viewer',
  };
}
