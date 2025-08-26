// app/api/templates/[id]/snapshots/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // must be logged in
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // parse body
  const body = await req.json().catch(() => null) as { template?: any; commit?: string } | null;
  if (!body?.template) return NextResponse.json({ error: 'Missing template' }, { status: 400 });
  const commit = String(body.commit ?? 'Snapshot').slice(0, 140);
  const t = body.template;

  // resolve base_slug from id or treat id as base_slug
  let base_slug = id;
  if (UUID_V4.test(id)) {
    const { data: row, error } = await supabaseAdmin
      .from('templates').select('base_slug').eq('id', id).maybeSingle();
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    base_slug = row.base_slug;
  }

  // (optional) ownership check: ensure the current user can snapshot this template
  // const { data: canonical } = await supabaseAdmin
  //   .from('templates').select('owner_id').eq('base_slug', base_slug).eq('is_version', false).maybeSingle();
  // if (canonical?.owner_id && canonical.owner_id !== user.id) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  // build version row
  const row: any = {
    is_version: true,
    archived: false,
    base_slug,
    slug: null,
    template_name: t.template_name ?? null,
    data: t.data ?? null,
    header_block: t.headerBlock ?? t.header_block ?? null,
    footer_block: t.footerBlock ?? t.footer_block ?? null,
    color_mode: t.color_mode ?? null,
    commit,
  };

  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert(row)
    .select('id, slug, base_slug, commit, created_at, updated_at, is_version')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ version: data });
}
