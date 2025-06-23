// app/admin/sites/[slug]/page.tsx

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ✅ Type directly and do not try to match PageProps — Next infers this correctly
export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const { data: site } = await supabase
    .from('published_sites')
    .select(
      '*, snapshots(data), branding_profiles(name, theme, brand, accent_color, logo_url)'
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!site) {
    return <p className="p-6 text-red-600">Site not found</p>;
  }

  const themeColor = site.branding_profiles?.accent_color || '#111';

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: `${themeColor}15` }}>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">{site.branding_profiles?.name}</h1>
          {site.branding_profiles?.logo_url && (
            <img
              src={site.branding_profiles.logo_url}
              className="w-10 h-10 rounded-full"
              alt="Logo"
            />
          )}
        </div>

        <pre className="text-sm bg-gray-100 p-4 rounded whitespace-pre-wrap">
          {JSON.stringify(site.snapshots?.data, null, 2)}
        </pre>

        <p className="mt-4 text-xs text-gray-400 text-right">
          quicksites.ai — viewed {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
