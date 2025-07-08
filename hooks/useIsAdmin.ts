// hooks/useIsAdmin.ts
'use client';

import { useSafeAuth } from '@/hooks/useSafeAuth';

export function useIsAdmin() {
  const { role } = useSafeAuth();
  return role === 'admin' || role === 'owner';
}
