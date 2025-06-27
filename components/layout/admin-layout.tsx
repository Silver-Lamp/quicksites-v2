'use client';

import { ReactNode } from 'react';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useCurrentUser();
  const { role } = useCanonicalRole();

  if (!ready || !user) {
    return <div className="p-6 text-white">Loading user session...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader user={user} role={role || ''} />
      <main>{children}</main>
    </div>
  );
}
