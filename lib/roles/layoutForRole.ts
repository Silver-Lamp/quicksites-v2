// lib/roles/layoutForRole.ts
import AdminLayout from '../../components/layouts/admin-layout';
import ViewerLayout from '../../components/layouts/viewer-layout';
import UnauthenticatedLayout from '../../components/layouts/unauthenticated-layout';

export function getLayoutForRole(role: string) {
  if (['admin', 'owner', 'reseller'].includes(role)) return AdminLayout;
  if (['viewer'].includes(role)) return ViewerLayout;
  return UnauthenticatedLayout;
}
