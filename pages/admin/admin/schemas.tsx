// pages/admin/schemas.tsx
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SupabaseSchemaDashboard() {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('saved_schemas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSchemas(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Head>
        <title>Synced Schemas</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-4">📂 Supabase Synced Schemas</h1>
        <input
          type="text"
          placeholder="Search by name or content..."
          onChange={(e) => {
            const val = e.target.value.toLowerCase();
            setSchemas((prev) =>
              prev.filter(
                (s) =>
                  s.name.toLowerCase().includes(val) ||
                  s.json.toLowerCase().includes(val)
              )
            );
          }}
          className="border px-2 py-1 w-full rounded text-sm mb-4"
        />
        {loading && <p className="text-gray-400">Loading...</p>}
        {!loading && schemas.length === 0 && <p>No schemas found.</p>}
        <ul className="space-y-4">
          {schemas.map((s) => (
            <li key={s.id} className="bg-white rounded shadow p-4">
              <p className="text-sm text-gray-600">
                <strong>{s.name}</strong>
                <span className="ml-2 text-xs text-gray-400">
                  ({new Date(s.created_at).toLocaleString()})
                </span>
              </p>
              <pre className="bg-gray-100 mt-2 p-2 text-xs overflow-auto rounded h-40">
                {JSON.stringify(JSON.parse(s.json), null, 2)}
              </pre>
              <div className="mt-2 text-right">
                <a
                  href={`/admin/zod-playground?schema=${encodeURIComponent(s.json)}`}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Import to Playground
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
