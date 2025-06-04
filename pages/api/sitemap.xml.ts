import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://quicksites.ai';
const MAX_URLS_PER_SITEMAP = 1000;

function generateXml(pages: { loc: string; changefreq: string; priority: number }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `<url><loc>${page.loc}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`
  )
  .join('
')}
</urlset>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const page = parseInt(req.query.page as string || '1', 10);
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
    priority: d.role === 'admin' ? 0.3 : 0.8
  }));

  const staticPages = page === 1
    ? [
        { loc: `${BASE_URL}/`, changefreq: 'daily', priority: 1.0 },
        { loc: `${BASE_URL}/admin/dashboard`, changefreq: 'weekly', priority: 0.5 },
        { loc: `${BASE_URL}/viewer`, changefreq: 'monthly', priority: 0.4 }
      ]
    : [];

  const xml = generateXml([...staticPages, ...dynamicPages]);

  res.setHeader('Content-Type', 'application/xml');
  res.write(xml);
  res.end();
}
