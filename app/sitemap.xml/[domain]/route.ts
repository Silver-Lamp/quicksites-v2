// app/sitemap.xml/[domain]/route.ts
//
// The sitemap for one published site, served at `https://<their-host>/sitemap.xml`.
//
// ⚠️ IT WAS ADVERTISING URLS THAT DO NOT EXIST. Every `<loc>` was built as
// `https://<host>/<site.slug>/<page>` — so `www.graftontowing.com`, a live customer site, handed
// Google `https://www.graftontowing.com/graftontowing`. That URL returns 200 (the custom-domain
// rewrite swallows any first segment) and renders a DIFFERENT page titled "graftontowing", so
// nothing 404s and nothing complains. The site slug is a routing segment; on the customer's own
// host it is not part of any address a visitor ever sees.
//
// ⚠️ AND ON A PLATFORM SUBDOMAIN IT RESOLVED NOTHING AT ALL. The lookup matched `slug` against the
// whole host, so `sandon.quicksites.ai` searched for a site with slug "sandon.quicksites.ai" and
// 404'd — while `robots.txt` on that same host went on advertising the sitemap. A sitemap that
// 404s and a sitemap full of wrong URLs fail in opposite directions and are equally invisible from
// inside the app: both are 200s from our own routes, and the only way to see either is to fetch
// the served bytes.

export const dynamic = 'force-dynamic';

import { getServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { siteSlugFromHost, sitePagePath } from '@/lib/seo/canonicalUrl';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: Request, { params }: { params: { domain: string } }) {
  const original = (params.domain || '').toLowerCase();
  const normalized = original.replace(/^www\./, '');

  const supabase = await getServerSupabase();

  // Match either a custom domain (`graftontowing.com`) or a platform subdomain label
  // (`sandon.quicksites.ai` → `sandon`). Previously only the former could ever match.
  const subLabel = siteSlugFromHost(normalized);
  const clauses = [
    `custom_domain.eq.${normalized}`,
    `custom_domain.eq.www.${normalized}`,
    `slug.eq.${normalized}`,
  ];
  if (subLabel) clauses.push(`slug.eq.${subLabel}`);

  const { data: site, error } = await supabase
    .from('templates')
    .select('slug, custom_domain, updated_at, data')
    .eq('is_site', true)
    .or(clauses.join(','))
    .maybeSingle();

  if (!site || error) {
    return new NextResponse('Site not found', { status: 404 });
  }

  // The host the request arrived on IS the site's public origin. Deriving it from the row instead
  // would republish the same guess this file exists to stop making.
  const base = `https://${new URL(req.url).host.toLowerCase()}`;

  const pages = (site.data as any)?.pages || [];
  const lastmod = new Date(site.updated_at || new Date()).toISOString();

  const urls = pages
    .filter((page: any) => page && typeof page.slug === 'string')
    .map((page: any) => {
      const loc = `${base}${sitePagePath(page.slug)}`;
      return `
      <url>
        <loc>${escapeXml(loc)}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>${page.slug === 'home' || page.slug === '' ? '1.0' : '0.7'}</priority>
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
