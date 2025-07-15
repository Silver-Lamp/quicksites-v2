'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { ClipboardCopy } from 'lucide-react';

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
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [siteName, setSiteName] = useState('');

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
        setSeoTitle(data.seo_title || '');
        setSeoDescription(data.seo_description || '');
        setTwitterHandle(data.twitter_handle || '');
        setSiteName(data.site_name || '');
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
        seo_title: seoTitle,
        seo_description: seoDescription,
        twitter_handle: twitterHandle,
        site_name: siteName,
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
    const { error: createError } = await supabase.from('sites').insert({
      ...original,
      slug: newSlug,
      published: false,
      created_at: new Date().toISOString(),
    });
    if (createError) alert('❌ Duplicate failed');
    else {
      alert('✅ Duplicated!');
      router.push(`/template/${newSlug}/edit`);
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
    const { error } = await supabase.storage.from('site-assets').upload(`${siteId}/${key}`, file, {
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
    <div className="flex flex-col h-full space-y-6 bg-zinc-900 overflow-y-auto rounded border border-zinc-700 p-6">
      <h2 className="text-xl font-semibold text-white">Site Settings</h2>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-zinc-400 mb-2">Basic Info</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Business Name</label>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
          {slug && slugAvailable !== null && (
            <p className={`text-sm mt-1 ${slugAvailable ? 'text-green-400' : 'text-red-400'}`}>
              {slugAvailable ? '✅ Available' : '🚫 Taken'}
            </p>
          )}
          {isPublished && (customDomain || slug) && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Live URL</label>
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`https://${customDomain || `${slug}.quicksites.ai`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        console.log('🔍 Tracking: live site clicked');
                        // TODO: Supabase.track("click_live_link", { siteId })
                      }}
                      className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition"
                    >
                      🔗 View Site
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    {customDomain
                      ? `Your domain should point to a CNAME record: ${slug}.quicksites.ai`
                      : `Visit your published site`}
                  </TooltipContent>
                </Tooltip>

                {/* Copy button */}
                <button
                  onClick={async () => {
                    const url = `https://${customDomain || `${slug}.quicksites.ai`}`;
                    await navigator.clipboard.writeText(url);
                    console.log('✅ Copied to clipboard:', url);
                  }}
                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white"
                  title="Copy to clipboard"
                >
                  <ClipboardCopy className="w-4 h-4" />
                </button>

                {customDomain && <span className="text-xs text-zinc-400">(custom domain)</span>}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Custom Domain</label>
          <input
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Color Scheme</label>
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          >
            <option value="">Choose Color Scheme</option>
            <option value="blue">Blue</option>
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={() => setIsPublished(!isPublished)}
          />
          <label className="text-sm font-medium text-zinc-300">Published</label>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-zinc-400 mb-2">🔍 SEO Settings</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">SEO Title</label>
          <input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">SEO Description</label>
          <textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Twitter Handle</label>
          <input
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            placeholder="@yourhandle"
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Site Name (OpenGraph)
          </label>
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-zinc-400 mb-2">Assets</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Favicon Upload</label>
          <input
            type="file"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'favicon.png')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Logo Upload</label>
          <input
            type="file"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo.png')}
          />
        </div>
      </fieldset>

      {analytics && (
        <div className="text-sm text-zinc-400">📊 {analytics.visits} visits recorded</div>
      )}

      <div className="flex justify-between pt-4 border-t border-zinc-700 mt-4">
        <button
          onClick={duplicateSite}
          disabled={loading}
          className="bg-yellow-600 px-3 py-2 rounded text-white"
        >
          📦 Duplicate
        </button>
        <button
          onClick={deleteSite}
          disabled={loading}
          className="bg-red-600 px-3 py-2 rounded text-white"
        >
          🗑 Delete
        </button>
        <button
          onClick={saveSettings}
          disabled={loading}
          className="bg-blue-600 px-3 py-2 rounded text-white"
        >
          💾 Save
        </button>
      </div>
    </div>
  );
}
