'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function BlockHub() {
  const router = useRouter();
  const { handle } = router.query;
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/blocks-by-handle?handle=' + handle)
      .then(res => res.json())
      .then(setBlocks);
  }, [handle]);

  return (
    <div className="p-6 text-white max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📍 Block Hub: @{handle}</h1>
      <ul className="space-y-4">
        {blocks.map((b: any) => (
          <li key={b.id} className="bg-zinc-800 rounded p-4">
            <div className="text-xl">{b.emoji} {b.title}</div>
            <div className="text-sm text-zinc-400">{b.message}</div>
            <a href={`/world/${handle}#block-${b.id}`} className="text-blue-400 text-xs hover:underline">
              View on map
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
