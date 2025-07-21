import { getSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { slug } = await req.json();
  if (!slug) return new Response('Missing slug', { status: 400 });

  const supabase = await getSupabase();
  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site) return new Response('Site not found', { status: 404 });

  const pages = site?.data?.pages || [];
  const results: Record<string, string> = {};

  for (const page of pages) {
    const res = await fetch('https://quicksites.ai/api/webhook/og-rebuild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, page: page.slug }),
    });
    results[page.slug] = res.ok ? '✅ success' : '❌ fail';
  }

  return Response.json({ slug, pages: results });
}
