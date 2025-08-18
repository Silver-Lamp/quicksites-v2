import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function GalleryPage() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('published_sites')
      .select('*, branding_profiles(name, logo_url)')
      .eq('status', 'published')
      .eq('is_public', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => setSites(data || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">🌐 GoodRobot Gallery</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/sites/${site.slug}`}
            className="block border rounded p-4 hover:shadow transition"
          >
            <div className="flex justify-between items-center mb-2">
              <strong>{site.branding_profiles?.name}</strong>
              {site.branding_profiles?.logo_url && (
                <img src={site.branding_profiles.logo_url} className="w-8 h-8 rounded-full" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">{site.slug}.quicksites.ai</p>
            <p className="text-xs italic text-gray-400">Language: {site.language || 'en'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
