// pages/admin/links.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Head from 'next/head';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function SchemaLinksDashboard() {
  const { user } = useCurrentUser();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('schema_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLinks(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <>
      <Head>
        <title>My Schema Links</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-4">🔗 My Schema Links</h1>
        {loading && <p className="text-gray-400">Loading...</p>}
        {!loading && links.length === 0 && <p>No schema links created yet.</p>}
        <ul className="space-y-4">
          {links.map((l) => (
            <li key={l.id} className="bg-white rounded shadow p-4">
              <p className="text-sm text-gray-600">
                <strong>ID:</strong> {l.id}
                <span className="ml-2 text-xs text-gray-400">
                  ({new Date(l.created_at).toLocaleString()})
                </span>
              </p>
              <pre className="bg-gray-100 mt-2 p-2 text-xs overflow-auto rounded h-40">
                {JSON.stringify(JSON.parse(l.json), null, 2)}
              </pre>
              <a
                href={`/admin/zod-playground?schema_id=${l.id}`}
                className="text-blue-600 text-sm underline mt-2 inline-block"
              >
                Open in Playground
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
