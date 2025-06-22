export const runtime = 'nodejs';

import { supabase } from '@/admin/lib/supabaseClient';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  const baseUrl = 'https://quicksites.ai';
  const pageSize = 1000;

  const { count, data: latest } = await supabase
    .from('domains')
    .select('created_at', { count: 'exact', head: false })
    .eq('is_claimed', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const totalPages = Math.ceil((count || 0) / pageSize);
  const lastmod = latest?.created_at || new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: totalPages })
  .map((_, i) => {
    const page = i + 1;
    return `<sitemap>
  <loc>${baseUrl}/api/sitemap.xml?page=${page}</loc>
  <lastmod>${lastmod}</lastmod>
</sitemap>`;
  })
  .join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
