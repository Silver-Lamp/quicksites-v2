'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';
import type { Role } from '@/types/user-context-types';
import { supabase } from '@/lib/supabase/client';

type RoleSource = 'simulated' | 'db' | 'context' | 'unknown';

function normalizeRole(input?: string | null): Role {
  switch ((input ?? '').toLowerCase()) {
    case 'admin':  return 'admin';
    case 'owner':  return 'owner';
    case 'editor': return 'editor';
    default:       return 'viewer';
  }
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);

  // Optional dev mocks (set in console for demos/tests)
  const mockRole = (typeof window !== 'undefined' && (window as any).__DEV_MOCK_ROLE__) as Role | undefined;
  const mockUser = (typeof window !== 'undefined' && (window as any).__DEV_MOCK_USER__) as
    | { id: string; email: string | null; avatar_url: string | null; name: string | null; bio: string | null }
    | undefined;
  const isMocked = Boolean(mockRole && mockUser);

  // Fallback role from DB (user_roles.new_role)
  const [dbRole, setDbRole] = useState<Role | null>(null);
  const [dbSourceReady, setDbSourceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const email = isMocked ? mockUser!.email : ctx.user?.email;
      if (!email) {
        setDbSourceReady(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('new_role')
          .eq('user_email', email)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && !error && data?.new_role) {
          setDbRole(normalizeRole(data.new_role));
        }
      } finally {
        if (!cancelled) setDbSourceReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ctx.user?.email, isMocked, mockUser?.email]);

  // Precedence: mock → DB → context → viewer
  const roleInfo = useMemo((): { role: Role; source: RoleSource } => {
    if (isMocked && mockRole) return { role: mockRole, source: 'simulated' };
    if (dbRole)               return { role: dbRole,  source: 'db' };
    if (ctx.user?.role)       return { role: normalizeRole(ctx.user.role), source: 'context' };
    return { role: 'viewer', source: 'unknown' };
  }, [isMocked, mockRole, dbRole, ctx.user?.role]);

  // Prefer real context user; if mocked, override id/email/role
  const combinedUser =
    isMocked && mockUser
      ? {
          ...(ctx.user ?? {}),
          id: mockUser.id,
          email: mockUser.email ?? '',
          role: roleInfo.role,
          avatar_url: mockUser.avatar_url ?? '',
          name: mockUser.name ?? '',
          bio: mockUser.bio ?? '',
        }
      : ctx.user
      ? { ...ctx.user, role: roleInfo.role }
      : null;

  const isLoading = !ctx.ready || !dbSourceReady;

  return {
    ...ctx,
    user: combinedUser,
    role: roleInfo.role,
    roleSource: roleInfo.source,
    isLoading,
    ready: !isLoading,
    isMocked,
    isAdmin: roleInfo.role === 'admin',
    isOwner: roleInfo.role === 'owner',
    isViewer: roleInfo.role === 'viewer',
  };
}
