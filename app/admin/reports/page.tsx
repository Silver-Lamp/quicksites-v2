'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function ReportsDashboardExtended() {
  const [log, setLog] = useState('');
  const [storage, setStorage] = useState<{ [key: string]: number }>({});
  const [dates, setDates] = useState<{ oldest: string; newest: string }>({
    oldest: '',
    newest: '',
  });
  const [email, setEmail] = useState('support@quicksites.ai');
  const [nightly, setNightly] = useState(true);
  const [weekly, setWeekly] = useState(true);

  useEffect(() => {
    fetch('/reports/activity.log')
      .then((res) => res.text())
      .then(setLog);

    fetch('/reports/analytics/index.json')
      .then((res) => res.json())
      .then((files) => {
        const csvs = files.filter((f: string) => f.endsWith('.csv')).length;
        const pdfs = files.filter((f: string) => f.endsWith('.pdf')).length;
        const sorted = files.filter((f: string) => f.match(/_(\d{4}-\d{2}-\d{2})/)).sort();
        const oldest = sorted[0]?.match(/_(\d{4}-\d{2}-\d{2})/)?.[1] || '';
        const newest = sorted.at(-1)?.match(/_(\d{4}-\d{2}-\d{2})/)?.[1] || '';
        setStorage({ csvs, pdfs });
        setDates({ oldest, newest });
      });
  }, []);

  const confirmDelete = () => {
    if (window.confirm('Are you sure? This will delete all CSVs, PDFs, and previews.')) {
      // You would replace this with a server call to delete files
      console.log('🧹 Deleting all archive files...');
    }
  };

  return (
    <div className="p-6 text-text">
      <h1 className="text-2xl font-bold mb-6">📁 Reports Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-800 p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">📋 Activity Log</h2>
          <pre className="text-sm overflow-auto whitespace-pre-wrap max-h-[300px] bg-black p-3 rounded">
            {log || 'Loading...'}
          </pre>
        </div>

        <div className="bg-zinc-800 p-4 rounded shadow space-y-3">
          <h2 className="text-lg font-semibold">📦 Storage Summary</h2>
          <ul className="text-sm space-y-1">
            <li>CSV Files: {storage.csvs ?? '—'}</li>
            <li>PDF Summaries: {storage.pdfs ?? '—'}</li>
            <li>Oldest Entry: {dates.oldest}</li>
            <li>Newest Entry: {dates.newest}</li>
          </ul>

          <h3 className="pt-4 font-semibold">⚙️ Automation Settings</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={nightly} onChange={() => setNightly(!nightly)} />
              Enable Nightly Exports
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={weekly} onChange={() => setWeekly(!weekly)} />
              Enable Weekly Summary
            </label>
            <label className="block text-sm mt-2">Recipient Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
            />
            <button className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mt-1">
              Save Email
            </button>
          </div>

          <div className="pt-4">
            <button
              className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={confirmDelete}
            >
              🗑 Delete All Archives
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
