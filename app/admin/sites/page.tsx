'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
// import Page from '@/components/layout/page';
// import AdminLayout from '@/components/admin/admin-layout';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SiteDirectory() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('public_sites') // ⚠️ was 'published_sites' before — confirm table name
      .select('*, branding_profiles(name, logo_url)')
      .eq('status', 'published')
      .eq('is_public', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => setSites(data || []));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Live Public Sites</h1>
      <ul className="space-y-4">
        {sites.map((site) => (
          <li key={site.id} className="border p-4 rounded flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{site.branding_profiles?.name}</div>
              <a
                className="text-blue-600 text-sm"
                href={`/sites/${site.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.slug}.quicksites.ai
              </a>
            </div>
            {site.branding_profiles?.logo_url && (
              <img
                src={site.branding_profiles.logo_url}
                alt="Logo"
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// 👇 Integrate with sidebar layout
// SiteDirectory.getLayout = (page: React.ReactNode) => (
//   <AdminSidebarLayout>{page}</AdminSidebarLayout>
// );
// SiteDirectory.getLayout = (page: any) => <AdminLayout>{page}</AdminLayout>;
SiteDirectory.getLayout = (page: any) => <>{page}</>;
