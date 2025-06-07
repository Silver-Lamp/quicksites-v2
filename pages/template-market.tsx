'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TemplateMarket() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(setTemplates);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">🎨 Template Market</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {templates.map((tpl, i) => (
          <div key={i} className="bg-zinc-800 rounded p-4 shadow">
            <img src={`/screenshots/${tpl.preview}`} className="w-full h-32 object-cover mb-2 rounded" />
            <h2 className="font-semibold text-lg">{tpl.name}</h2>
            <p className="text-sm text-zinc-400 mb-2">{tpl.description}</p>
            <Link href={`/starter?template=${tpl.id}`} className="text-blue-400 text-xs underline">
              Use this →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
