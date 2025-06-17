'use client';
import { NextSeo } from 'next-seo';
import { json } from '@/lib/api/json';
import { usePageSeo } from '@/lib/usePageSeo';
import { useEffect, useState } from 'react';

export default function TransparencyViewer() {
  const [sites, setSites] = useState([]);
  const seo = usePageSeo({
    description: 'Transparency page.',
  });

  useEffect(() => {
    fetch('/api/public-sites')
      .then((res) => json())
      .then(setSites);
  }, []);

  return (
    <>
      <NextSeo {...seo} />
      <div className="p-6 max-w-5xl mx-auto text-white">
        <h1 className="text-3xl font-bold mb-6">🧿 Transparency Viewer</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sites.map((site: any) => (
            <div key={site.domain} className="bg-zinc-800 rounded shadow p-4">
              <img
                src={`/screenshots/${site.domain}.thumb.png`}
                alt={site.domain}
                className="w-full h-32 object-cover rounded mb-2"
              />
              <h2 className="text-lg font-semibold">{site.domain}</h2>
              <p className="text-sm text-zinc-400">{site.template_id}</p>
              <p className="text-xs text-zinc-500">
                {new Date(site.claimed_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
