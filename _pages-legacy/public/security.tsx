'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function PublicSecurityReports() {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('security-reports')
          .list('', {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (error) throw new Error(error.message);

        const pdfNames = (data || [])
          .filter((f) => f.name.endsWith('.pdf'))
          .map((f) => f.name);

        setFiles(pdfNames);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unexpected error');
        }
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto text-text">
      <h1 className="text-2xl font-bold mb-4">🔍 Public Security Reports</h1>

      {loading && (
        <p className="text-sm text-zinc-400">Loading reports...</p>
      )}

      {error && (
        <div className="text-sm text-red-500 bg-zinc-900 p-2 rounded">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <p className="text-sm text-zinc-500">No reports found.</p>
      )}

      {!loading && !error && files.length > 0 && (
        <ul className="space-y-2 text-sm mt-4">
          {files.map((file) => (
            <li key={file}>
              <a
                href={`https://your-project-ref.supabase.co/storage/v1/object/public/security-reports/${file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                {file}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
