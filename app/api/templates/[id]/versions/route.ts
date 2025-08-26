// app/api/templates/[id]/versions/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // must be logged in
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // resolve base_slug from id or treat id as base_slug
  let base_slug = id;
  if (UUID_V4.test(id)) {
    const { data: row, error } = await supabaseAdmin
      .from('templates').select('base_slug').eq('id', id).maybeSingle();
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    base_slug = row.base_slug;
  }

  // canonical (for published_version_id / owner check if you want)
  const { data: c, error: cErr } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id, published_version_id')
    .eq('base_slug', base_slug)
    .eq('is_version', false)
    .maybeSingle();
  if (cErr || !c) return NextResponse.json({ error: 'Canonical not found' }, { status: 404 });

  // list versions (newest-first)
  const { data: versions, error: vErr } = await supabaseAdmin
    .from('templates')
    .select('id, slug, commit, created_at, updated_at')
    .eq('base_slug', base_slug)
    .eq('is_version', true)
    .order('updated_at', { ascending: false });

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

  return NextResponse.json({
    versions: versions ?? [],
    published_version_id: c.published_version_id ?? null,
  });
}
