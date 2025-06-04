import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PublicSite() {
  const { query } = useRouter();
  const [site, setSite] = useState<any>(null);

  useEffect(() => {
    const slug = query.slug;
    if (!slug || typeof slug !== 'string') return;

    supabase
      .from('published_sites')
      .select('*, snapshots(data), branding_profiles(name, theme, brand, accent_color, logo_url)')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(({ data }) => {
        if (data) {
          setSite(data);
          supabase.from('published_site_views').insert([
            {
              site_id: data.id,
              referrer: document.referrer,
              user_agent: navigator.userAgent
            }
          ]);
        }
      });
  }, [query.slug]);

  if (!site) return <p className="p-6">Loading site...</p>;

  const themeColor = site.branding_profiles?.accent_color || '#111';

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: themeColor + '15' }}>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">{site.branding_profiles?.name}</h1>
          {site.branding_profiles?.logo_url && (
            <img src={site.branding_profiles.logo_url} className="w-10 h-10 rounded-full" />
          )}
        </div>

        <pre className="text-sm bg-gray-100 p-4 rounded">
          {JSON.stringify(site.snapshots?.data, null, 2)}
        </pre>

        <p className="mt-4 text-xs text-gray-400 text-right">
          quicksites.ai — viewed {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
