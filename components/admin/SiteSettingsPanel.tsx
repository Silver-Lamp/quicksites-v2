'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SiteSettingsPanel({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [bizName, setBizName] = useState('');
  const [location, setLocation] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [colorScheme, setColorScheme] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [analytics, setAnalytics] = useState<{ visits: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .maybeSingle();

      if (!error && data) {
        setBizName(data.business_name || '');
        setLocation(data.location || '');
        setSlug(data.slug || '');
        setColorScheme(data.color_scheme || '');
        setIsPublished(data.published || false);
        setCustomDomain(data.custom_domain || '');
      }
    })();
  }, [siteId]);

  useEffect(() => {
    if (!slug) return setSlugAvailable(null);
    const delay = setTimeout(async () => {
      const { data } = await supabase
        .from('sites')
        .select('id')
        .eq('slug', slug)
        .not('id', 'eq', siteId)
        .maybeSingle();
      setSlugAvailable(!data);
    }, 300);
    return () => clearTimeout(delay);
  }, [slug]);

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      const { count, error } = await supabase
        .from('site_visits')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', siteId);
      if (!error) setAnalytics({ visits: count || 0 });
    })();
  }, [siteId]);

  const saveSettings = async () => {
    if (!slugAvailable) return alert('Slug not available.');
    const { error } = await supabase
      .from('sites')
      .update({
        business_name: bizName,
        location,
        slug,
        color_scheme: colorScheme,
        published: isPublished,
        custom_domain: customDomain,
      })
      .eq('id', siteId);
    if (error) alert('❌ Save failed.');
    else alert('✅ Settings saved!');
  };

  const duplicateSite = async () => {
    const newSlug = prompt('New slug for duplicate site:');
    if (!newSlug) return;
    const { data: original, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !original) return alert('❌ Fetch failed');
    const { error: createError } = await supabase
      .from('sites')
      .insert({
        ...original,
        slug: newSlug,
        published: false,
        created_at: new Date().toISOString(),
      });
    if (createError) alert('❌ Duplicate failed');
    else {
      alert('✅ Duplicated!');
      router.push(`/edit/${newSlug}`);
    }
  };

  const deleteSite = async () => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    setLoading(true);
    const { error } = await supabase.from('sites').delete().eq('id', siteId);
    if (error) alert('❌ Delete failed');
    else router.push('/dashboard');
  };

  const handleUpload = async (file: File, key: string) => {
    const { error } = await supabase.storage
      .from('site-assets')
      .upload(`${siteId}/${key}`, file, {
        cacheControl: '3600',
        upsert: true,
      });
    if (error) alert('❌ Upload failed');
    else alert(`${key} uploaded!`);
  };

  console.log('✅ SiteSettingsPanel mounted with siteId:', siteId);
//   return (
//     <div className="bg-red-600 text-white p-6 text-center rounded-lg">
//       <p>🔥 Settings panel loaded for site: {siteId}</p>
//     </div>
//   );
  
  return (
    <div className="space-y-4 bg-zinc-800 p-4 rounded border border-zinc-600">
      <h2 className="text-xl font-bold">Site Settings</h2>

      <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Business Name" className="w-full p-2 bg-zinc-900 rounded" />
      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="w-full p-2 bg-zinc-900 rounded" />
      <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} placeholder="Slug" className="w-full p-2 bg-zinc-900 rounded" />
      {slug && slugAvailable !== null && (
        <p className={`text-sm ${slugAvailable ? 'text-green-400' : 'text-red-400'}`}>
          {slugAvailable ? '✅ Available' : '🚫 Taken'}
        </p>
      )}

      <input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="Custom Domain (e.g. mysite.com)" className="w-full p-2 bg-zinc-900 rounded" />

      <select value={colorScheme} onChange={e => setColorScheme(e.target.value)} className="w-full p-2 bg-zinc-900 rounded">
        <option value="">Choose Color Scheme</option>
        <option value="blue">Blue</option>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="dark">Dark</option>
      </select>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isPublished} onChange={() => setIsPublished(!isPublished)} />
        {isPublished ? '✅ Published' : '🚧 Draft'}
      </label>

      <div>
        <label className="text-sm text-zinc-400">Favicon Upload</label>
        <input type="file" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'favicon.png')} />
      </div>

      <div>
        <label className="text-sm text-zinc-400">Logo Upload</label>
        <input type="file" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo.png')} />
      </div>

      {analytics && (
        <div className="text-sm text-zinc-400">📊 {analytics.visits} visits recorded</div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={duplicateSite} disabled={loading} className="bg-yellow-600 px-3 py-2 rounded text-white">📦 Duplicate</button>
        <button onClick={deleteSite} disabled={loading} className="bg-red-600 px-3 py-2 rounded text-white">🗑 Delete</button>
        <button onClick={saveSettings} disabled={loading} className="bg-blue-600 px-3 py-2 rounded text-white">💾 Save</button>
      </div>
    </div>
  );
}
