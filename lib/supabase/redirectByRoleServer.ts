'use server';

import { redirect } from 'next/navigation';
import { getSessionContext } from './getSessionContext';

type RoleMap = Partial<Record<string, string>>;

type Options = {
  roleRoutes?: RoleMap;
  fallbackRoute?: string;
};

/**
 * Server-side redirect helper that routes users based on their role.
 */
export async function redirectByRoleServer({
  roleRoutes = {
    admin: '/admin/dashboard',
    owner: '/admin/dashboard',
    reseller: '/admin/dashboard',
    viewer: '/viewer',
  },
  fallbackRoute = '/unauthorized',
}: Options = {}) {
  const { user, role } = await getSessionContext();

  if (!user) {
    redirect('/login');
  }

  const target = roleRoutes[role] || fallbackRoute;

  console.log(`[🧭 redirectByRoleServer] ${role} → ${target}`);
  redirect(target);
}
