'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function PrintLabels() {
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
    <div className="p-4 print:p-0 bg-white text-black grid grid-cols-2 sm:grid-cols-3 gap-4">
      {blocks.map((b: any) => (
        <div key={b.id} className="border p-3 rounded text-center text-sm break-words">
          <div className="text-xl">{b.emoji} {b.title}</div>
          <p className="text-xs text-zinc-600">{b.message}</p>
          <img
            src={`/api/block-qr?handle=${handle}&blockId=${b.id}`}
            alt="QR"
            className="w-32 h-32 mx-auto my-2"
          />
          <p className="text-xs text-zinc-500">quicksites.ai/world/{handle}#block-{b.id}</p>
        </div>
      ))}
    </div>
  );
}
