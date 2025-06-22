'use client';
import Link from 'next/link';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function BlockHub() {
  const router = useRouter();
  const { handle } = router.query;
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/blocks-by-handle?handle=' + handle)
      .then((res) => res.json())
      .then(setBlocks);
  }, [handle]);

  return (
    <div className="p-6 text-white max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📍 Block Hub: @{handle}</h1>
      <ul className="space-y-4">
        {blocks.map((b: any) => (
          <li key={b.id} className="bg-zinc-800 rounded p-4">
            <div className="text-xl">
              {b.emoji} {b.title}
            </div>
            <div className="text-sm text-zinc-400">{b.message}</div>
            <Link
              href={`/hub/${handle}/print`}
              className="inline-block mb-6 text-blue-400 hover:underline text-sm"
            >
              🖨️ Print All Block Labels
            </Link>
            <img
              src={`/api/block-qr?handle=${handle}&blockId=${b.id}`}
              alt="QR code"
              className="mt-3 w-24 h-24 rounded bg-white p-1"
            />
            <a
              href={`/world/${handle}#block-${b.id}`}
              className="text-blue-400 text-xs hover:underline"
            >
              View on map
            </a>
            <a
              href={`/api/print-labels-pdf?handle=${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-500 hover:underline text-sm mt-2"
            >
              🧾 Download as PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
