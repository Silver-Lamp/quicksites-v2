// app/api/sitemap.xml/route.ts
export const runtime = 'nodejs';

import { supabase } from '@/admin/lib/supabaseClient';
import { NextRequest } from 'next/server';

const BASE_URL = 'https://quicksites.ai';
const MAX_URLS_PER_SITEMAP = 1000;

function generateXml(pages: { loc: string; changefreq: string; priority: number }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) =>
      `<url><loc>${page.loc}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`
  )
  .join('\n')}
</urlset>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url || '');
  const pageParam = url.searchParams.get('page');
  const page = parseInt(pageParam || '1', 10);
  const offset = (page - 1) * MAX_URLS_PER_SITEMAP;

  const { data: domains } = await supabase
    .from('domains')
    .select('domain, lang, role')
    .eq('is_claimed', true)
    .order('domain', { ascending: true })
    .range(offset, offset + MAX_URLS_PER_SITEMAP - 1);

  const dynamicPages = (domains || []).map((d) => ({
    loc: `${BASE_URL}/${d.lang ?? 'en'}/site/${d.domain}`,
    changefreq: d.role === 'admin' ? 'monthly' : 'weekly',
    priority: d.role === 'admin' ? 0.3 : 0.8,
  }));

  const staticPages =
    page === 1
      ? [
          { loc: `${BASE_URL}/`, changefreq: 'daily', priority: 1.0 },
          { loc: `${BASE_URL}/admin/dashboard`, changefreq: 'weekly', priority: 0.5 },
          { loc: `${BASE_URL}/viewer`, changefreq: 'monthly', priority: 0.4 },
        ]
      : [];

  const xml = generateXml([...staticPages, ...dynamicPages]);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
