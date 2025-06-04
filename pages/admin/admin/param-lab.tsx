// pages/admin/param-lab.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';


import { queryParamSchemas } from '@/admin/lib/queryParamSchemas';
import { extractTags, summarizeQuery } from '@/admin/lib/queryUtils';
import QueryParamEditor from '@/components/admin/QueryParamEditor';
import PresetCard from '@/components/admin/PresetCard';
import TagFilterControls from '@/components/admin/TagFilterControls';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ParamLabPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const slug = (router.query.slug || 'campaign') as string;
  const schema = queryParamSchemas[slug];

  const [paramsString, setParamsString] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [presets, setPresets] = useState<Record<string, string>>({});
  const [presetName, setPresetName] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const param = url.searchParams.get('tags');
      return param ? param.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
    }
    return [];
  });
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const mode = url.searchParams.get('tagMode');
      return mode === 'any' ? 'any' : 'all';
    }
    return 'all';
  });

  const updateShareInfo = () => {
    const url = new URL(window.location.href);
    const paramEntries = Array.from(url.searchParams.entries()).filter(([k]) => k !== 'slug');
    const query = paramEntries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    setParamsString(query);
    setShareUrl(window.location.href);
  };

  useEffect(() => {
    updateShareInfo();
  }, [slug, router.query]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('param_presets').select('*').eq('slug', slug).eq('user_id', user.id).then(({ data }) => {
      const fromCloud = data?.reduce((acc, curr) => {
        acc[`☁️ ${curr.name}`] = curr.query;
        return acc;
      }, {} as Record<string, string>);
      const local = JSON.parse(localStorage.getItem('param-presets') || '{}');
      setPresets({ ...fromCloud, ...local });
    });
  }, [slug, user]);

  const allTags = Object.entries(
    Object.values(presets)
      .flatMap(query => extractTags(query))
      .reduce((acc, tag) => {
        const key = tag.toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
  ).filter(([_, count]) => count >= 2).sort((a, b) => b[1] - a[1]);

  const savePreset = async () => {
    const updated = { ...presets, [presetName]: paramsString };
    setPresets(updated);
    localStorage.setItem('param-presets', JSON.stringify(updated));
    if (user?.id) {
      await supabase.from('param_presets').upsert({ slug, name: presetName, query: paramsString, user_id: user.id });
    }
    alert('Preset saved!');
  };

  const deletePreset = async (name: string) => {
    if (!confirm(`Delete preset "${name}"?`)) return;
    const updated = { ...presets };
    delete updated[name];
    setPresets(updated);
    localStorage.setItem('param-presets', JSON.stringify(updated));
    await supabase.from('param_presets').delete().match({ slug, name: name.replace(/^☁️ /, ''), user_id: user?.id });
  };

  const handleApply = (query: string) => {
    const url = new URL(window.location.href);
    url.search = `?slug=${slug}&${query}`;
    router.push(url.pathname + url.search);
  };

  const handleShare = (name: string, query: string) => {
    const url = `${window.location.origin}/admin/param-lab?slug=${slug}&${query}`;
    navigator.clipboard.writeText(url);
    alert(`Copied shareable link for "${name}"!`);
  };

  if (!schema) return <div className="p-4 text-red-600">Unknown schema: {slug}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">🧪 Param Lab</h1>
        <select className="border px-2 py-1 rounded" value={slug} onChange={(e) => router.push(`/admin/param-lab?slug=${e.target.value}`)}>
          {Object.keys(queryParamSchemas).map(key => <option key={key} value={key}>{key}</option>)}
        </select>
      </div>

      <div className="text-sm text-gray-500 space-y-2">
        <p><strong>Query Preview:</strong> {paramsString || '(none)'}</p>
        <div className="border p-2 inline-block bg-white">
          <QRCode value={shareUrl} size={120} />
        </div>
      </div>

      <TagFilterControls
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        tagMatchMode={tagMatchMode}
        setTagMatchMode={setTagMatchMode}
        allTags={allTags}
      />

      <div className="flex gap-2">
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name"
          className="border px-2 py-1 rounded w-full"
        />
        <button onClick={savePreset} className="text-sm bg-green-600 text-white px-4 py-1 rounded">Save Preset</button>
      </div>

      <ul className="space-y-2">
        {Object.entries(presets)
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(([_, query]) => {
            const tags = extractTags(query).map(t => t.toLowerCase());
            return tagMatchMode === 'all'
              ? tagFilter.every(f => tags.includes(f))
              : tagFilter.length === 0 || tagFilter.some(f => tags.includes(f));
          })
          .map(([name, query]) => (
            <PresetCard
              key={name}
              name={name}
              query={query}
              slug={slug}
              onDelete={deletePreset}
              onShare={handleShare}
              onApply={handleApply}
            />
        ))}
      </ul>

      <QueryParamEditor schema={schema} slug={slug} />
    </div>
  );
}
