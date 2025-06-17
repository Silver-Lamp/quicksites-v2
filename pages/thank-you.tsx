'use client';
import { NextSeo } from 'next-seo';
import { usePageSeo } from '@/lib/usePageSeo';
import { useEffect, useState } from 'react';

export default function ThankYouPage() {
  const [ref, setRef] = useState<any>(null);

  useEffect(() => {
    const data = localStorage.getItem('referrer_info');
    if (data) setRef(JSON.parse(data));
  }, []);
  const seo = usePageSeo({
    description: 'Thank you page.',
  });
  return (
    <>
      <NextSeo {...seo} />
      <div className="p-6 max-w-xl mx-auto text-white text-center">
        <h1 className="text-3xl font-bold mb-4">✅ Thank You for Joining!</h1>
        <p className="text-zinc-400 mb-4">
          Your signal has been received. We’ll be in touch soon.
        </p>

        {ref && (
          <div className="bg-zinc-800 rounded p-4 mt-6 text-left text-sm">
            <h2 className="text-white text-base font-semibold mb-2">
              📡 Attribution Info
            </h2>
            <ul className="space-y-1 text-zinc-300">
              {Object.entries(ref).map(([k, v]) => (
                <li key={k}>
                  <strong>{k}</strong>: {String(v)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
