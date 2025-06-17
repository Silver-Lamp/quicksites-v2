'use client';
import { useRouter } from 'next/router';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';

export default function SupportersPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [supporters, setSupporters] = useState<any[]>([]);

  useEffect(() => {
    if (!slug) return;
    fetch('/api/supporters?handle=' + slug)
      .then((res) => json())
      .then(setSupporters);
  }, [slug]);

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">🫂 Supporters</h1>
      {supporters.length === 0 && (
        <p className="text-zinc-400">No support received yet.</p>
      )}
      <ul className="space-y-3">
        {supporters.map((s: any, i) => (
          <li key={i} className="bg-zinc-800 p-3 rounded">
            <div className="text-sm text-green-400">
              User: {s.user_id.slice(0, 8)}
            </div>
            <div className="text-xs text-zinc-300">
              🎉 {s.cheer || 0} • 🔁 {s.echo || 0} • 🪞 {s.reflect || 0}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
