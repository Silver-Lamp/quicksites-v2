'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CreateSitePage() {
  const router = useRouter();

  const [siteName, setSiteName] = useState('');
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('id, name, data')
      .eq('published', true)
      .then(({ data: templateData, error: templateError }) => {
        if (!templateError && templateData) {
            console.log(`.:.Template data:`, JSON.stringify(templateData, null, 2));
            setTemplates(templateData);
        }
      });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .insert([ 
        {
          site_name: siteName,
          slug,
          template_id: templateId || null,
          data: templateId ? templates.find((t) => t.id === templateId)?.data : {},
          is_published: false,
        },
      ])
      .select()
      .single();

    setLoading(false);

    console.log(`.:.Site data:`, JSON.stringify(siteData, null, 2));

    if (siteError) {
      setError(siteError.message);
    } else if (siteData?.slug) {
      router.push(`/site/${siteData.slug}/edit`);
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
