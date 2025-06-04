import React from 'react';
import AppHeader from '@/components/admin/AppHeader';
import AdminLayout from '@/components/admin/AdminLayout';
import useLastSeen from '@/hooks/useLastSeen';

export default function Page({ children }: { children: React.ReactNode }) {
  useLastSeen();
  return (
    <AdminLayout>
      <AppHeader />
      <div className="p-4">{children}</div>
    </AdminLayout>
  );
}
