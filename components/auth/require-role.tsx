// lib/components/auth/RequireRole.tsx
'use client';

import { ReactNode } from 'react';
import { useSession } from '@/lib/providers/SessionProvider';

type Props = {
  role: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export default function RequireRole({ role, fallback = null, children }: Props) {
  const { role: currentRole } = useSession();

  const allowed = Array.isArray(role)
    ? role.includes(currentRole)
    : currentRole === role;

  return allowed ? <>{children}</> : <>{fallback}</>;
}
