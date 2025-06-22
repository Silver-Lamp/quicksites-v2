'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import Link from 'next/link';

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    fetch('/api/discover')
      .then((res) => res.json())
      .then(setProfiles);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">🌍 Discover Public Worlds</h1>
      {profiles.length === 0 && <p className="text-zinc-400">No public profiles yet.</p>}
      <ul className="space-y-4">
        {profiles.map((p: any) => (
          <li key={p.user_id} className="bg-zinc-800 p-4 rounded shadow">
            <div className="text-xl font-semibold">
              <Link href={`/world/${p.handle}/share`} className="hover:underline">
                {p.emoji} @{p.handle}
              </Link>
            </div>
            {p.bio && <p className="text-sm text-zinc-400 mt-1">{p.bio}</p>}
            {p.goal_tags?.length > 0 && (
              <div className="text-xs text-green-400 uppercase mt-1">{p.goal_tags.join(' • ')}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
