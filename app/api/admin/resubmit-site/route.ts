import { NextResponse } from 'next/server';
import { pingSearchEngines } from '@/lib/pingSearchEngines';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const supabase = await getServerSupabase();
  const { data: template, error } = await supabase
    .from('templates')
    .select('slug, custom_domain')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const sitemapUrl = template.custom_domain
    ? `https://${template.custom_domain}/sitemap.xml`
    : `https://quicksites.ai/_sites/${slug}/sitemap.xml`;

  await pingSearchEngines(sitemapUrl, slug);

  return NextResponse.json({ success: true });
}
