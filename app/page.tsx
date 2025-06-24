'use client';

import React from 'react';
import AppHeader from '@/components/admin/AppHeader/app-header';
import AdminLayout from '@/components/admin/admin-layout';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Page({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const { role } = useCanonicalRole();

  return (
    <AdminLayout>
      <AppHeader />

      {/* Debug banner */}
      <div className="text-xs text-gray-400 bg-zinc-900 px-4 py-2 border-b border-zinc-700">
        <code>
          Session: {user?.email ?? 'not signed in'} | Role: {role ?? 'unknown'}
        </code>
      </div>

      <div className="p-4">{children}</div>
    </AdminLayout>
  );
}
