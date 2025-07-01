'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import Link from 'next/link';

export default function SupportDirectory() {
  const [campaigns, setCampaigns] = useState([]);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then(setCampaigns);
  }, []);

  const filtered = actionFilter
    ? campaigns.filter((c: any) => c.target_action === actionFilter)
    : campaigns;

  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">📣 Support Directory</h1>

      <div className="space-x-2 text-sm">
        <button onClick={() => setActionFilter('')} className="underline text-blue-400">
          All
        </button>
        <button onClick={() => setActionFilter('cheer')} className="underline text-green-400">
          🎉 Cheer
        </button>
        <button onClick={() => setActionFilter('echo')} className="underline text-blue-300">
          🔁 Echo
        </button>
        <button onClick={() => setActionFilter('reflect')} className="underline text-purple-300">
          🪞 Reflect
        </button>
        <button onClick={() => setActionFilter('checkin')} className="underline text-yellow-300">
          ✅ Check-in
        </button>
      </div>

      <ul className="space-y-4">
        {filtered.map((c: any) => (
          <li key={c.slug} className="bg-zinc-800 p-4 rounded">
            <Link
              href={`/support/${c.slug}`}
              className="text-blue-400 text-lg font-semibold hover:underline"
            >
              {c.headline}
            </Link>
            <p className="text-sm text-zinc-400">
              {c.goal_count} {c.target_action}s goal • Created{' '}
              {new Date(c.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
