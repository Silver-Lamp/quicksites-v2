export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: Request, { params }: { params: { domain: string } }) {
  const { domain } = params;
  const supabase = await getSupabase();

  const { data: site, error } = await supabase
    .from('templates')
    .select('slug, custom_domain, updated_at, data')
    .eq('is_site', true)
    .or(`custom_domain.eq.${domain},slug.eq.${domain}`)
    .maybeSingle();

  if (!site || error) {
    return new NextResponse('Site not found', { status: 404 });
  }

  const base = site.custom_domain ? `https://${site.custom_domain}` : `https://quicksites.ai`;
  const pages = site.data?.pages || [];

  const urls = pages.map((page: any) => {
    const path = page.slug === 'home' || page.slug === '' ? '' : `/${page.slug}`;
    const url = `${base}/${site.slug}${path}`;
    const lastmod = new Date(site.updated_at || new Date()).toISOString();
    return `
      <url>
        <loc>${escapeXml(url)}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
    `;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
