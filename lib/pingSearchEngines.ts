import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be server-side only
);

export async function pingSearchEngines(sitemapUrl: string) {
  const urls = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  try {
    await Promise.all(urls.map((u) => fetch(u)));
    console.log('✅ Pinged search engines');

    await supabaseAdmin.from('sitemap_logs').insert({
      action: 'ping',
      status: 'success',
      sitemap_url: sitemapUrl,
    });
  } catch (err) {
    console.error('❌ Sitemap ping failed:', err);
    await supabaseAdmin.from('sitemap_logs').insert({
      action: 'ping',
      status: 'error',
      error: String(err),
      sitemap_url: sitemapUrl,
    });
  }
}
