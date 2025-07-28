// app/admin/hooks/useSafeAuth.ts
'use client';

import { useSession } from '@/lib/providers/SessionProvider';

export function useSafeAuth() {
  const { user, role } = useSession();

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          avatar_url: user.avatar_url ?? '',
          name: user.email.split('@')[0], // or pull from metadata if needed
        }
      : null,
    role,
    isLoggedIn: !!user,
    ip: undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}
