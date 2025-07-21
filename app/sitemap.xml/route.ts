import { getSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await getSupabase();
  const { data: sites } = await supabase
    .from('templates')
    .select('slug, custom_domain, updated_at, data')
    .eq('is_site', true);

  const urls: string[] = [];

  for (const site of sites || []) {
    const base = site.custom_domain ? `https://${site.custom_domain}` : `https://quicksites.ai`;
    const pages = site.data?.pages || [];

    for (const page of pages) {
      const url = `${base}/${site.slug}/${page.slug}`;
      const lastmod = new Date(site.updated_at || new Date()).toISOString();

      urls.push(`
        <url>
          <loc>${url}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `);
    }
  }

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('')}
</urlset>`.trim();

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
