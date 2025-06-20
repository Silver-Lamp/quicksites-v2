'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useUser } from '@supabase/auth-helpers-react';

export default function PosterBatchView() {
  const user = useUser();
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/my-campaigns?user_id=' + user.id)
      .then((res) => json())
      .then(setCampaigns);
  }, [user]);

  return (
    <div className="p-6 text-white max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🖨️ Poster Print Batch</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {campaigns.map((c: any) => (
          <div key={c.slug} className="bg-zinc-800 p-4 rounded">
            <img
              src={`/posters/${c.slug}`}
              alt={c.headline}
              className="w-full rounded shadow border border-zinc-700"
            />
            <div className="mt-2 text-sm text-zinc-300 truncate">{c.headline}</div>
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
