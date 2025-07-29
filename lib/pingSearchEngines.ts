import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be server-side only
);

export async function pingSearchEngines(sitemapUrl: string, slug: string) {
  const urls = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  try {
    const responses = await Promise.all(
      urls.map(async (u) => {
        const res = await fetch(u);
        const text = await res.text();
        return {
          url: u,
          status: res.status,
          ok: res.ok,
          body: text,
        };
      })
    );

    await supabaseAdmin.from('sitemap_logs').insert(
      responses.map((r) => ({
        action: 'ping',
        status: r.ok ? 'success' : 'error',
        sitemap_url: sitemapUrl,
        response_status: r.status,
        response_body: r.body,
      }))
    );

    await supabaseAdmin
      .from('templates')
      .update({
        search_engines_last_pinged_at: new Date().toISOString(),
        search_engines_last_ping_response: responses,
      })
      .eq('slug', slug);
  } catch (err) {
    console.error('❌ Sitemap ping failed:', err);

    await supabaseAdmin.from('sitemap_logs').insert({
      action: 'ping',
      status: 'error',
      sitemap_url: sitemapUrl,
      error: String(err),
    });

    await supabaseAdmin
      .from('templates')
      .update({
        search_engines_last_pinged_at: new Date().toISOString(),
        search_engines_last_ping_response: { error: String(err) },
      })
      .eq('slug', slug);
  }
}
