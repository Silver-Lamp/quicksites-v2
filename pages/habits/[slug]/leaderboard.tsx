'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function HabitLeaderboard() {
  const router = useRouter();
  const { slug } = router.query;
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!slug) return;
    fetch('/api/habit-leaderboard?slug=' + slug)
      .then(res => res.json())
      .then(setEntries);
  }, [slug]);

  return (
    <div className="max-w-xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">🏆 {slug} Leaderboard</h1>
      {!entries.length && <p className="text-zinc-400">Loading...</p>}
      <ol className="space-y-3 list-decimal list-inside">
        {entries.map((e: any, i: number) => (
          <li key={i} className="bg-zinc-800 p-3 rounded">
            <div className="flex justify-between">
              <span>User: {e.user_id.slice(0, 8)}…</span>
              <span className="text-green-400">{e.total} check-ins</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
