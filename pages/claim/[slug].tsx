'use client';
import { useState, useEffect } from 'react';
import { json } from '@/lib/api/json';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get('slug') as string;
  const [status, setStatus] = useState<'loading' | 'claimed' | 'unclaimed'>('loading');
  const [email, setEmail] = useState('');
  const [anon, setAnon] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (slug) {
      fetch(`/api/check-claim?slug=${slug}`)
        .then((res) => res.json())
        .then((d) => setStatus(d.claimed ? 'claimed' : 'unclaimed'));
    }
  }, [slug]);

  const handleSubmit = async () => {
    await fetch('/api/claim-site', {
      method: 'POST',
      body: JSON.stringify({ slug, email, anon }),
    });
    setSubmitted(true);
  };

  if (!slug) return null;

  return (
    <div className="max-w-xl mx-auto text-white p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">🪪 Claim {slug}</h1>
      <img
        src={`/screenshots/${slug}.thumb.png`}
        alt={`${slug} preview`}
        className="w-full h-40 object-cover rounded mb-4"
      />

      {status === 'claimed' && (
        <p className="text-red-400 text-sm mb-4">This site has already been claimed.</p>
      )}

      {status === 'unclaimed' && !submitted && (
        <>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded bg-zinc-800 mb-3 text-white"
          />
          <label className="flex items-center gap-2 mb-4 justify-center">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            <span className="text-sm text-zinc-300">Claim anonymously</span>
          </label>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            onClick={handleSubmit}
          >
            Claim this site
          </button>
        </>
      )}

      {submitted && (
        <p className="text-green-400 mt-4">🎉 You’ve claimed this site successfully.</p>
      )}
    </div>
  );
}
