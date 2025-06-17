'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function PublicSecurityReports() {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch('https://your-project-ref.supabase.co/storage/v1/object/list/security-reports', {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    })
      .then((res) => json())
      .then((data) => {
        const names = (data || []).map((f: any) => f.name).filter((f: string) => f.endsWith('.pdf'));
        setFiles(names);
      });
  }, []);

  return (
    <div className="p-6 text-text max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔍 Public Security Reports</h1>
      <ul className="space-y-2 text-sm">
        {files.map((file) => (
          <li key={file}>
            <a
              href={`https://your-project-ref.supabase.co/storage/v1/object/public/security-reports/${file}`}
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {file}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
