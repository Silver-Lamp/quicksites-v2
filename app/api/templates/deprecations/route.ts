export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('template_admin_meta')
    .select('deprecated_files')
    .eq('template_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deprecated_files: data?.deprecated_files ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, deprecated_files } = body as { id?: string; deprecated_files?: string[] };
  if (!id || !Array.isArray(deprecated_files)) {
    return NextResponse.json({ error: 'id and deprecated_files[] required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('template_admin_meta')
    .upsert({ template_id: id, deprecated_files, updated_at: new Date().toISOString() }, { onConflict: 'template_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
