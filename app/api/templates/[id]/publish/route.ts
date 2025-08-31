// app/api/templates/[id]/publish/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { version_id }: { version_id?: string } = await req.json().catch(() => ({}));

  const supa = await getServerSupabase();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve base_slug from id (UUID) or use value as base_slug
  let base_slug = id;
  if (UUID_V4.test(id)) {
    const { data: row, error } = await supabaseAdmin
      .from('templates')
      .select('base_slug')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    base_slug = row.base_slug;
  }

  // Load canonical
  const { data: c, error: cErr } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id')
    .eq('base_slug', base_slug)
    .eq('is_version', false)
    .maybeSingle();
  if (cErr || !c) return NextResponse.json({ error: 'Canonical not found' }, { status: 404 });

  // Owner or admin check
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adminRow && c.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Update publish pointer on canonical
  const { error: upErr } = await supabaseAdmin
    .from('templates')
    .update({
      published: true,
      published_version_id: version_id ?? null,
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq('id', c.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, published_version_id: version_id ?? null });
}
