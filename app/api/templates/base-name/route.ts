import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return undefined; }
  }
  return undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  let base_slug = url.searchParams.get('base_slug') || '';
  const template_id = url.searchParams.get('template_id') || '';

  const supabase = await getServerSupabase();

  // Resolve base_slug from template_id if needed
  let canonFallbackName: string | null = null;
  if (!base_slug && template_id) {
    const { data: trow, error: terr } = await supabase
      .from('templates')
      .select('base_slug,template_name,data')
      .eq('id', template_id)
      .maybeSingle();
    if (terr) return NextResponse.json({ error: terr.message }, { status: 500 });
    base_slug = trow?.base_slug || '';
    const data = safeParse<any>(trow?.data);
    const siteTitle = (data?.meta?.siteTitle || trow?.template_name || '').toString().trim();
    if (siteTitle) canonFallbackName = siteTitle;
  }

  if (!base_slug) return NextResponse.json({ error: 'base_slug or template_id required' }, { status: 400 });

  // Return meta display name if present; else return canonical fallback
  const { data: row, error } = await supabase
    .from('template_base_meta')
    .select('display_name')
    .eq('base_slug', base_slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    display_name: row?.display_name ?? canonFallbackName ?? null,
  });
}

export async function POST(req: Request) {
  const { base_slug, display_name } = await req.json();
  if (!base_slug || !display_name) {
    return NextResponse.json({ error: 'base_slug and display_name required' }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from('template_base_meta')
    .upsert({ base_slug, display_name });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional: refresh your MV if you wired that RPC
  try {
    await supabase.rpc('refresh_template_bases');
  } catch {
    console.error('Error refreshing template bases:', error);
  }

  return NextResponse.json({ ok: true });
}
