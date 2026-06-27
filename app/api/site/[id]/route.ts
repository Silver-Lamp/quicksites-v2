// app/api/site/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
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

  const supabase = await getServerSupabase();

  // sites has no top-level `pages` column — site content lives in the `data` jsonb.
  // Merge pages into the existing blob rather than overwriting it (the old code wrote to a
  // non-existent `pages` column and always 500'd). See Supabase types migration.
  const { data: existing } = await supabase
    .from('sites')
    .select('data')
    .eq('id', siteId)
    .maybeSingle();

  const mergedData = {
    ...(((existing?.data as Record<string, any> | null)) ?? {}),
    pages: body.pages as Page[],
  };

  const { error } = await supabase
    .from('sites')
    .update({
      data: mergedData as any,
      updated_at: new Date().toISOString(),
    } as any)
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
  
    const supabase = await getServerSupabase();
    const { error } = await supabase
      .from('sites')
      .update(body)
      .eq('id', siteId);
  
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  
    return NextResponse.json({ success: true });
  }
  