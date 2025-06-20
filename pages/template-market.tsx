'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import Link from 'next/link';
import { NextSeo } from 'next-seo';

export default function TemplateMarket() {
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/template-api')
      .then((res) => json())
      .then(setTemplates);
  }, []);

  return (
    <>
      <NextSeo title="Template Market" description="Pick a template to start" />
      <div className="p-6 max-w-5xl mx-auto text-white">
        <h1 className="text-3xl font-bold mb-6">🎨 Template Market</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {templates.filter(Boolean).map((tpl, i) => (
            <div key={tpl.id || i} className="bg-zinc-800 rounded p-4 shadow">
              {tpl.thumbnail_url && (
                <img
                  src={tpl.thumbnail_url}
                  alt={tpl.template_name}
                  className="w-full h-32 object-cover mb-2 rounded"
                />
              )}
              <h2 className="font-semibold text-lg">{tpl.template_name}</h2>
              <p className="text-sm text-zinc-400 mb-2">{tpl.description || 'No description'}</p>
              <Link
                href={`/starter?template=${tpl.template_name}`}
                className="text-blue-400 text-xs underline"
              >
                Use this →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
