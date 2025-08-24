// app/admin/users/page.tsx
import UsersPlansManager from '@/components/admin/users/users-plans-manager';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return <UsersPlansManager />;
}