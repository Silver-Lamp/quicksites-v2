'use client';
import { useRouter } from 'next/router';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';
import { usePageSeo } from '@/lib/usePageSeo';
import { NextSeo } from 'next-seo';
import { useSession } from '@supabase/auth-helpers-react';
import { useUser } from '@supabase/auth-helpers-react';
import { Template } from '@/types/template';

export default function CreatorTemplatesPage() {
  const router = useRouter();
  const { handle } = router.query;
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/templates-by-creator?handle=' + handle)
      .then((res) => json())
      .then(setTemplates);
  }, [handle]);

  return (
    <div className="text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🎨 Templates by @{handle}</h1>
      <ul className="space-y-4">
        {templates.map((t: Template, i) => (
          <li key={i} className="bg-zinc-800 rounded p-4">
            <div className="font-semibold">{t.name}</div>
            <div className="text-zinc-400 text-sm">{t.headline || t.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
