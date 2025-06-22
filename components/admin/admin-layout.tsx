// components/AdminLayout.tsx
import BreadcrumbNav from './breadcrumb-nav';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  if (isLoading) return <div className="p-4 text-sm">Loading...</div>;
  if (!user) {
    router.push('/unauthorized');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-white shadow-lg p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-4">Admin</h2>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/admin/dashboard" className="hover:underline text-blue-700">
            Dashboard
          </Link>
          <Link href="/admin/sites" className="hover:underline text-blue-700">
            Sites
          </Link>
          <Link href="/admin/param-lab" className="hover:underline text-blue-700">
            Param Lab
          </Link>
          <Link href="/admin/zod-playground" className="hover:underline text-blue-700">
            Zod Playground
          </Link>
          <Link href="/admin/logs" className="hover:underline text-blue-700">
            Logs
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <BreadcrumbNav />
        <div className="bg-white shadow rounded p-6">{children}</div>
      </main>
    </div>
  );
}
