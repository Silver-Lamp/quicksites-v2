'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function AnalyticsArchivePage() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    fetch('/reports/analytics/index.json')
      .then((res) => res.json())
      .then(setFiles);
  }, []);

  return (
    <div className="p-6 text-text">
      <h1 className="text-xl font-bold mb-4">📂 Archived Analytics Reports</h1>
      <ul className="space-y-4">
        {files.map((file) => (
          <li key={file}>
            {file.endsWith('.pdf') ? (
              <div className="flex gap-4 items-start">
                <img
                  src={`/previews/${file.replace('.pdf', '.png')}`}
                  alt="Preview"
                  className="w-40 rounded border border-zinc-600 shadow"
                />
                <div>
                  <button
                    onClick={() => setSelectedFile(file)}
                    className="text-green-400 hover:underline text-left font-mono"
                  >
                    {file}
                  </button>
                </div>
              </div>
            ) : (
              <a
                href={`/reports/analytics/${file}`}
                className="text-blue-400 hover:underline"
                download
              >
                {file}
              </a>
            )}
          </li>
        ))}
      </ul>

      {selectedFile && selectedFile.endsWith('.pdf') && (
        <div className="mt-6 border rounded bg-white p-2">
          <iframe
            src={`/reports/analytics/${selectedFile}`}
            className="w-full h-[80vh]"
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
}
