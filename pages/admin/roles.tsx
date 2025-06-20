// ✅ FILE: pages/admin/roles.tsx

'use client';

import AuthGuard from '@/components/admin/auth-guard';
import RoleManager from '@/components/admin/role-manager';

export default function AdminRolesPage() {
  return (
    <AuthGuard roles={['admin']}>
      <div className="p-6 text-white">
        <h1 className="text-2xl font-bold mb-4">Manage User Roles</h1>
        <RoleManager />
      </div>
    </AuthGuard>
  );
}
