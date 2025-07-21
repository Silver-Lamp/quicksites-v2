import { getSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await getSupabase();
  const { data: sites } = await supabase
    .from('templates')
    .select('slug, custom_domain')
    .eq('is_site', true);

  const sitemapUrls = (sites || []).map((site) => {
    const domain = site.custom_domain || `quicksites.ai`;
    return `https://${domain}/sitemap.xml`;
  });

  const content = [
    'User-agent: *',
    'Allow: /',
    ...sitemapUrls.map((url) => `Sitemap: ${url}`)
  ].join('\n');

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
