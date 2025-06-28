// hooks/useIsAdmin.ts
'use client';

import { useSession } from '@/lib/providers/SessionProvider';

export function useIsAdmin() {
  const { role } = useSession();
  return role === 'admin' || role === 'owner';
}
