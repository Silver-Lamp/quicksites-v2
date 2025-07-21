import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { slug } = await req.json();
  if (!slug) return new Response('Missing slug', { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: site } = await supabase
    .from('templates')
    .select('data, slug, id')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site) {
    console.error(`[og-rebuild] ❌ No site found for slug: ${slug}`);
    return new Response('Site not found', { status: 404 });
  }

  if (!site?.data?.pages || !Array.isArray(site.data.pages)) {
    console.error(`[og-rebuild] ❌ site.data.pages is missing or malformed for slug: ${slug}`);
    return new Response('Malformed or missing site data.pages', { status: 400 });
  }

  const pages = site.data.pages;
  const results: Record<string, string> = {};

  for (const page of pages) {
    const liveUrl = `https://quicksites.ai/sites/${slug}/${page.slug}`;
    console.log(`[og-rebuild] Rebuilding: ${liveUrl}`);

    const res = await fetch('https://quicksites.ai/api/webhook/og-rebuild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        page: page.slug,
        url: liveUrl,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[og-rebuild] ❌ Failed for ${page.slug}: ${res.status} ${errorText}`);
    }

    results[page.slug] = res.ok ? '✅ success' : `❌ fail: ${res.status}`;
  }

  return Response.json({ slug, pages: results }, { status: 200 });
}
