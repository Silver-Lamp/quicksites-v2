import { NextRequest } from 'next/server';
import { supabase } from '@/admin/lib/supabaseClient';

export const runtime = 'nodejs';

function escapeXml(unsafe: string) {
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateXml(pages: { loc: string; changefreq: string; priority: number }[]) {
  const urlEntries = pages
    .map((page) => {
      return `
<url>
  <loc>${escapeXml(page.loc)}</loc>
  <changefreq>${page.changefreq}</changefreq>
  <priority>${page.priority}</priority>
</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export async function GET(req: NextRequest, { params }: { params: { domain: string } }) {
  const domain = params.domain;

  const { data: site } = await supabase
    .from('templates')
    .select('slug, data')
    .in('custom_domain', [domain, `www.${domain}`])
    .eq('published', true)
    .maybeSingle();

  if (!site) {
    return new Response('Not found', { status: 404 });
  }

  const slug = site.slug;
  const pages = (site.data as any)?.pages || [];

  const urls = pages.map((page: any) => ({
    loc: `https://${domain}/${page.slug}`,
    changefreq: 'weekly',
    priority: 0.8,
  }));

  const xml = generateXml(urls);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
