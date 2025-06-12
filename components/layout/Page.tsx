// ✅ FILE: /components/layout/Page.tsx

'use client';

import React from 'react';
import AppHeader from '@/components/admin/AppHeader/AppHeader';
import AdminLayout from '@/components/admin/AdminLayout';
import { useUser } from '@supabase/auth-helpers-react';

export default function Page({ children }: { children: React.ReactNode }) {
  const user = useUser();

  return (
    <AdminLayout>
      <AppHeader />

      {/* Debug banner */}
      <div className="text-xs text-gray-400 bg-zinc-900 px-4 py-2 border-b border-zinc-700">
        <code>
          Session: {user?.email ?? 'not signed in'} | Role: {user?.user_metadata?.role ?? 'unknown'}
        </code>
      </div>

      <div className="p-4">{children}</div>
    </AdminLayout>
  );
}
