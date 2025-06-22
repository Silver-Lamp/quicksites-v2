'use client';
import { useRouter } from 'next/router';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';

export default function BlockDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [block, setBlock] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetch('/api/block?id=' + id)
      .then((res) => res.json())
      .then(setBlock);
  }, [id]);

  if (!block) return <div className="text-white p-6">Loading...</div>;

  return (
    <div className="text-white p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">
        {block.emoji} {block.title}
      </h1>
      <p className="text-zinc-400">{block.message}</p>
      <p className="text-sm text-zinc-600">
        Lat: {block.lat}, Lon: {block.lon}
      </p>
      <img
        src={`/api/block-qr?handle=${block.owner_handle || 'me'}&blockId=${block.id}`}
        className="w-32 h-32 mt-4"
        alt="QR"
      />
      <div>
        <a
          href={`/api/print-labels-pdf?handle=${block.owner_handle || 'me'}`}
          className="text-blue-400 hover:underline text-sm"
        >
          🧾 Print PDF with this label
        </a>
      </div>
    </div>
  );
}
