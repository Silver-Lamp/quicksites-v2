'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CreatorTemplatesPage() {
  const router = useRouter();
  const { handle } = router.query;
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/templates-by-creator?handle=' + handle)
      .then(res => res.json())
      .then(setTemplates);
  }, [handle]);

  return (
    <div className="text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🎨 Templates by @{handle}</h1>
      <ul className="space-y-4">
        {templates.map((t, i) => (
          <li key={i} className="bg-zinc-800 rounded p-4">
            <div className="font-semibold">{t.name}</div>
            <div className="text-zinc-400 text-sm">{t.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
