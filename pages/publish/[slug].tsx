'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/router';
import { Template } from '@/types/template';

export default function PublishPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [template, setTemplate] = useState<Template | null>(null);
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done'>('idle');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/template?domain=${slug}`)
      .then((res) => json())
      .then((d) => setTemplate(d?.data));
  }, [slug]);

  const handlePublish = async () => {
    setStatus('publishing');
    await fetch('/api/publish-site', {
      method: 'POST',
      body: JSON.stringify({ domain: slug }),
    });
    setStatus('done');
  };

  return (
    <div className="max-w-xl mx-auto p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-4">🚀 Publish: {slug}</h1>
      {template && (
        <>
          <p className="mb-2 text-sm text-zinc-400">Template: {template.id}</p>
          <img
            src={`/screenshots/${slug}.thumb.png`}
            alt={`${slug} preview`}
            className="w-full h-32 object-cover rounded mb-4"
          />
        </>
      )}
      {status === 'done' ? (
        <p className="text-green-400 font-medium">🎉 Published! Visit: https://{slug}</p>
      ) : (
        <button
          onClick={handlePublish}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          {status === 'publishing' ? 'Publishing…' : 'Publish Site'}
        </button>
      )}
    </div>
  );
}
