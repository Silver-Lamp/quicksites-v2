'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function AdminPrintAll() {
  const [campaigns, setCampaigns] = useState([]);
  const [filterAction, setFilterAction] = useState('');
  const [filterCreator, setFilterCreator] = useState('');

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => json())
      .then(setCampaigns);
  }, []);

  const filtered = campaigns.filter(
    (c: any) =>
      (!filterAction || c.target_action === filterAction) &&
      (!filterCreator || c.created_by === filterCreator)
  );

  const creators = Array.from(
    new Set(campaigns.map((c: any) => c.created_by))
  ).sort();

  return (
    <div className="p-6 text-white max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">📦 All Campaign Posters</h1>
      <a
        href="/api/all-campaign-posters"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        ⬇️ Download ZIP (All Posters)
      </a>

      <div className="flex gap-4 text-sm pt-4">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-black p-2 rounded"
        >
          <option value="">All Actions</option>
          <option value="cheer">🎉 Cheer</option>
          <option value="echo">🔁 Echo</option>
          <option value="reflect">🪞 Reflect</option>
          <option value="checkin">✅ Check-in</option>
        </select>
        <select
          value={filterCreator}
          onChange={(e) => setFilterCreator(e.target.value)}
          className="text-black p-2 rounded"
        >
          <option value="">All Creators</option>
          {creators.map((id) => (
            <option key={id} value={id}>
              {id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((c: any) => (
          <div key={c.slug} className="bg-zinc-800 p-4 rounded">
            <img
              src={`/posters/${c.slug}`}
              alt={c.headline}
              className="w-full rounded shadow border border-zinc-700"
            />
            <div className="mt-2 text-sm text-zinc-300 truncate">
              {c.headline}
            </div>
            <p className="text-xs text-zinc-500">
              By {c.created_by?.slice(0, 8) || 'anon'}
            </p>
            <a
              href={`/posters/${c.slug}`}
              download={`${c.slug}-poster.png`}
              className="text-blue-400 hover:underline text-xs"
            >
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
