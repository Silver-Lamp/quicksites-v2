// 'use server';

// import { redirect } from 'next/navigation';
// import { getSessionContext } from './getSessionContext';

// type Role = 'admin' | 'owner' | 'reseller' | 'viewer' | string;

// type RoleMap = Partial<Record<Role, string>>;

// type Options = {
//   roleRoutes?: RoleMap;
//   fallbackRoute?: string;
// };

// /**
//  * Server-side redirect helper that routes users based on their role.
//  * Redirects to a defined route or fallback if role is unknown.
//  */
// export async function redirectByRoleServer({
//   roleRoutes = {
//     admin: '/admin/dashboard',
//     owner: '/admin/dashboard',
//     reseller: '/admin/dashboard',
//     viewer: '/viewer',
//   },
//   fallbackRoute = '/unauthorized',
// }: Options = {}) {
//   const { user, role } = await getSessionContext();

//   if (!user) {
//     console.log('[🧭 redirectByRoleServer] No user session — redirecting to /login');
//     redirect('/login');
//   }

//   const destination = roleRoutes[role] ?? fallbackRoute;

//   console.log(`[🧭 redirectByRoleServer] Resolved route for role "${role}": ${destination}`);
//   redirect(destination);
// }
