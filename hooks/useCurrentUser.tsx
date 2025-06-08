// ✅ FILE: hooks/useCurrentUser.tsx

import { useEffect, useState } from 'react';
import { useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';

export function useCurrentUser() {
  const supaUser = useUser();
  const { isLoading } = useSessionContext();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supaUser?.email) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_email', supaUser.email)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data?.role) setRole(data.role);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [supaUser?.email]);

  const showOnboarding = !!supaUser?.email && !role;

  const allowAdminPromotion = ['sandon@quicksites.ai', 'jurowski@gmail.com', 'sandonjurowski@gmail.com'].includes(supaUser?.email || '');

  return {
    email: supaUser?.email ?? null,
    user: supaUser,
    role,
    loading: isLoading || loading,
    hasRole: (roles: string[]) => role ? roles.includes(role) : false,
    showOnboarding,
    allowAdminPromotion,
    roleBadge: () => role ? (
      <span className="bg-zinc-800 border border-white px-2 py-1 text-xs rounded-full">
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    ) : (
      <span className="text-red-400 text-xs">? Unknown</span>
    ),
  };
}
