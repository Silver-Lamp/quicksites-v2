'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

export default function CreateSitePage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const [siteName, setSiteName] = useState('');
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('id, name')
      .eq('published', true)
      .then(({ data, error }) => {
        if (!error && data) setTemplates(data);
      });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('sites')
      .insert([
        {
          site_name: siteName,
          slug,
          template_id: templateId || null,
          content: {}, // default empty content — can evolve later
          is_published: false,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (data?.slug) {
      router.push(`/site/${data.slug}/edit`);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Site</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900 p-6 rounded shadow">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Site Name</label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            URL will be: <code>{slug}.quicksites.ai</code>
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Template (optional)</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
          >
            <option value="">— None —</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          {loading ? 'Creating...' : 'Create Site'}
        </button>
      </form>
    </div>
  );
}
