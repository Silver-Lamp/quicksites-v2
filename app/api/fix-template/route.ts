// app/api/fix-template/route.ts
import { getSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { fixes } = await req.json();
  const slug = new URL(req.url).searchParams.get('slug');

  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const supabase = await getSupabase();
  const { data: site, error } = await supabase
    .from('templates')
    .select('data')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site || error) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updatedPages = site.data.pages.map((page: any) => ({
    ...page,
    content_blocks: page.content_blocks.map((block: any) => ({
      ...block,
      content: {
        ...block.content,
        ...(fixes[block._id] || {}),
      },
    })),
  }));

  const { error: updateError } = await supabase
    .from('templates')
    .update({ data: { pages: updatedPages } })
    .eq('slug', slug);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
