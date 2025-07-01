'use client';
import { useState } from 'react';
import { json } from '@/lib/api/json';

export default function MatchPage() {
  const [tags, setTags] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const res = await fetch('/api/match?tags=' + encodeURIComponent(tags));
    const json = await res.json();
    setResults(json);
  };

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">🔍 Match by Goals</h1>
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="e.g. floss, meditate"
        className="text-black p-2 w-full rounded"
      />
      <button onClick={search} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
        Match
      </button>

      <ul className="space-y-3 pt-4">
        {results.map((r: any) => (
          <li key={r.user_id} className="bg-zinc-800 p-4 rounded">
            <div className="text-lg">
              <a href={`/world/${r.handle}/share`} className="text-blue-400 hover:underline">
                {r.emoji} @{r.handle}
              </a>
            </div>
            <p className="text-sm text-zinc-400">{r.bio}</p>
            <div className="text-xs text-green-400 uppercase mt-1">{r.goal_tags?.join(' • ')}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
