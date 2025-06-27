// /app/admin/page.tsx
'use client';

import { useAutoRedirectByRole } from '@/hooks/useAutoRedirectByRole';

export default function AdminHomeRedirect() {
  useAutoRedirectByRole({
    roleRoutes: {
      admin: '/admin/dashboard',
      owner: '/admin/dashboard',
      reseller: '/admin/dashboard',
      viewer: '/viewer',
    },
    fallbackRoute: '/unauthorized',
    enableTestBypass: true,
  });

  return (
    <p className="text-center p-6 text-sm text-gray-400">
      Redirecting to the right place...
    </p>
  );
}
