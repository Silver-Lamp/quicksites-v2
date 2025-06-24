import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function useResolvedRole(): [string | null, () => Promise<void>] {
  const [role, setRole] = useState<string | null>(null);

  const resolveRole = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setRole(null);
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
  };

  useEffect(() => {
    resolveRole();
  }, []);

  return [role, resolveRole];
}

export function useRoleAccessGuard(allowedRoles: string[]) {
  const [role, resolveRole] = useResolvedRole();
  const router = useRouter();

  useEffect(() => {
    if (!role) return;

    const email = localStorage.getItem('cached-email') ?? '';
    const isOwner = email === 'sandonjurowski@gmail.com';

    if (!allowedRoles.includes(role) && !isOwner) {
      router.push('/unauthorized');
    }
  }, [role, allowedRoles, router]);

  return role;
}

export async function getServerResolvedRole(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  return profile?.role ?? 'viewer';
}
