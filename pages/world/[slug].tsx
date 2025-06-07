'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function WorldViewer() {
  const router = useRouter();
  const { slug } = router.query;
  const [blocks, setBlocks] = useState([]);
  const [position, setPosition] = useState<any>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos.coords);
        fetch(`/api/nearby-blocks?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
          .then(res => res.json())
          .then(setBlocks);
      },
      () => console.warn('Geolocation denied')
    );
  }, []);

  return (
    <div className="text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🌍 World View: @{slug}</h1>

      {!blocks.length && <p className="text-zinc-500">Loading nearby blocks...</p>}

      <ul className="space-y-4">
        {blocks.map((b: any, i: number) => (
          <li key={b.id} className="bg-zinc-800 rounded p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">{b.emoji} {b.title}</h2>
                <p className="text-zinc-400 text-sm">{b.message}</p>
              </div>
              {b.image_url && (
                <img src={b.image_url} alt="block" className="w-16 h-16 rounded object-cover" />
              )}
            </div>
            <div className="mt-4 space-x-2">
              {(b.actions || []).map((a: any, j: number) => (
                <button key={j} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded">
                  {a.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
