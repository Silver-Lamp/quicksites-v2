// components/layout/page.tsx

import AppHeader from '@/components/admin/AppHeader/app-header';
import AdminLayout from '@/components/layout/admin-layout';
import { getSessionContext } from '@/lib/supabase/getSessionContext';

export default async function AdminLayoutWithHeader({ children }: { children: React.ReactNode }) {
  const { userId, userEmail, role } = await getSessionContext();

  const safeUser = {
    id: userId ?? '',
    email: userEmail ?? '',
    avatar_url: '',
  };

  return (
    <AdminLayout>
      <AppHeader />

      <div className="text-xs text-gray-400 bg-zinc-900 px-4 py-2 border-b border-zinc-700">
        <code>
          Authenticated as {safeUser.email} with role {role}
        </code>
      </div>

      <div className="p-6">{children}</div>
    </AdminLayout>
  );
}
