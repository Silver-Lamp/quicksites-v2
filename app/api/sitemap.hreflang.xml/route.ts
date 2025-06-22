export const runtime = 'nodejs';

import { supabase } from '@/admin/lib/supabaseClient';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  const baseUrl = 'https://quicksites.ai';

  const { data: domains } = await supabase
    .from('domains')
    .select('domain, lang')
    .eq('is_claimed', true);

  const langGroups = (domains || []).reduce<
    Record<string, Array<{ domain: string; lang: string }>>
  >((acc, d) => {
    const base = d.domain.replace(/\.[a-z]+$/, '');
    if (!acc[base]) acc[base] = [];
    acc[base].push({ ...d, lang: d.lang || 'en' });
    return acc;
  }, {});

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${Object.entries(langGroups)
  .map(([base, versions]) => {
    const defaultLang = versions.find((v) => v.lang === 'en') || versions[0];
    const loc = `${baseUrl}/${defaultLang.lang}/site/${defaultLang.domain}`;
    const links = versions
      .map(
        (v) =>
          `<xhtml:link rel="alternate" hreflang="${v.lang}" href="${baseUrl}/${v.lang}/site/${v.domain}" />`
      )
      .join('\n    ');
    return `<url>
  <loc>${loc}</loc>
  ${links}
</url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
