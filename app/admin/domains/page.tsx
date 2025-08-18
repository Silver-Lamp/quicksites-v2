// app/admin/domains/page.tsx
import { cookies as nextCookies } from 'next/headers';
import Link from 'next/link';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type DomainRow = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
  created_at?: string | null;
};

export default async function DomainsPage() {
  // ✅ Next 14/15: await cookies() before using it
  const store = await nextCookies();

  const supabase: SupabaseClient<Database> = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );

  const { data: domains, error } = await supabase
    .from('domains')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-4 text-red-500">Error loading domains: {error.message}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/domains/new"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create New Site
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">All Domains</h1>

      <div className="overflow-x-auto rounded border border-gray-800">
        <table className="min-w-full text-sm text-left text-gray-300 dark:text-gray-100">
          <thead className="bg-gray-800 text-gray-200">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {domains?.map((domain: DomainRow) => (
              <tr key={domain.id}>
                <td className="px-4 py-2">{domain.name}</td>
                <td className="px-4 py-2">{domain.slug}</td>
                <td className="px-4 py-2">{domain.status ?? '—'}</td>
                <td className="px-4 py-2">
                  {domain.created_at ? new Date(domain.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/edit/${domain.slug}`} className="text-blue-400 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}

            {domains?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No domains found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
