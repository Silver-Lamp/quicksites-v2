// app/api/site/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import type { SiteData, Page } from '@/types/site';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const siteId = params.id;
  const body = await req.json();

  // Minimal validation
  if (!body.pages || !Array.isArray(body.pages)) {
    return NextResponse.json(
      { error: 'Missing or invalid `pages` field' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseClient();

  const { error } = await supabase
    .from('sites')
    .update({
      pages: body.pages as Page[], // assumes Supabase column `pages` is a `jsonb` column
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (error) {
    console.error('[❌ site update error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const siteId = params.id;
    const body = await req.json();
  
    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('sites')
      .update(body)
      .eq('id', siteId);
  
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  
    return NextResponse.json({ success: true });
  }
  