import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function useRoleAccess(allowedRoles: string[]) {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push('/unauthorized');
        return;
      }

      const email = user.email ?? '';
      const cacheKey = `cached-role-${email}`;
      let resolvedRole = localStorage.getItem(cacheKey) || 'viewer';

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.role) {
        resolvedRole = profile.role;
        localStorage.setItem(cacheKey, resolvedRole);
      }

      setRole(resolvedRole);

      const isOwner = email === 'sandonjurowski@gmail.com';

      if (!allowedRoles.includes(resolvedRole) && !isOwner) {
        router.push('/unauthorized');
      }
    };

    checkAccess();
  }, [allowedRoles, router]);

  return role;
}
