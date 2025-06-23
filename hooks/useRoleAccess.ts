import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export function useRoleAccess(allowedRoles: string[]) {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      const userRole = user?.user_metadata?.role || 'viewer';
      setRole(userRole);

      const isOwner = user?.email === 'sandonjurowski@gmail.com';

      if (!allowedRoles.includes(userRole) && !isOwner) {
        router.push('/unauthorized');
      }
    });
  }, [allowedRoles]);

  return role;
}
