'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';

export default function PrintLabels() {
  const searchParams = useSearchParams();
  const handle = searchParams?.get('handle') as string;
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/blocks-by-handle?handle=' + handle)
      .then((res) => res.json())
      .then(setBlocks);
  }, [handle]);

  return (
    <div className="p-4 print:p-0 bg-white text-black grid grid-cols-2 sm:grid-cols-3 gap-4">
      {blocks.map((b: any) => (
        <div key={b.id} className="border p-3 rounded text-center text-sm break-words">
          <div className="text-xl">
            {b.emoji} {b.title}
          </div>
          <p className="text-xs text-zinc-600">{b.message}</p>
          <img
            src={`/api/block-qr?handle=${handle}&blockId=${b.id}`}
            alt="QR"
            className="w-32 h-32 mx-auto my-2"
          />
          <p className="text-xs text-zinc-500">
            quicksites.ai/world/{handle}#block-{b.id}
          </p>
          <div className="flex justify-center">
            <a
              href={`/api/print-labels-pdf?handle=${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-500 hover:underline text-sm mt-2"
              style={{ border: '1px solid #222' }}
            >
              🧾 Download as PDF
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
