'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/router';
import { BlocksEditor } from '@/components/admin/templates/blocks-editor';
import type { Block } from '@/types/blocks';

export default function PublicEditPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [data, setData] = useState<Block[] | null>(null);
  const [forked, setForked] = useState(false);

  useEffect(() => {
    if (slug) {
      fetch(`/api/template?domain=${slug}`)
        .then((res) => res.json())
        .then((d) => setData(d.data));
    }
  }, [slug]);

  const saveFork = async () => {
    await fetch('/api/fork-template', {
      method: 'POST',
      body: JSON.stringify({ base_slug: slug, data }),
    });
    setForked(true);
  };

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Remix: {slug}</h1>
      {data && <BlocksEditor blocks={data} onChange={(updated) => setData(updated)} />}
      <button onClick={saveFork} className="mt-4 bg-green-700 px-4 py-2 rounded">
        Save a Copy
      </button>
      {forked && <p className="text-green-400 mt-2">Forked! Check /starter to claim it.</p>}
    </div>
  );
}
