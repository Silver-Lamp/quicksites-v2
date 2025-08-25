export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const shortId = () => Math.random().toString(36).slice(2, 6);

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }   // unified param name
) {
  const { id } = await ctx.params;
  const supa = await getServerSupabase();

  // must be logged in
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve base_slug:
  // - if `id` is a UUID, look up that row to get base_slug
  // - else treat the value as base_slug directly (your UI sends base_slug)
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

  // Fetch the canonical (non-version) row
  const { data: c, error: cErr } = await supabaseAdmin
    .from('templates')
    .select('*')
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

  // Insert snapshot (let DB compute generated cols like base_slug / is_version)
  const { data: v, error: insErr } = await supabaseAdmin
    .from('templates')
    .insert({
      template_name: c.template_name,
      slug: `${c.base_slug}-${shortId()}`,
      layout: c.layout,
      color_scheme: c.color_scheme,
      theme: c.theme,
      brand: c.brand,
      industry: c.industry,
      color_mode: c.color_mode,

      business_name: c.business_name,
      contact_email: c.contact_email,
      phone: c.phone,
      address_line1: c.address_line1,
      address_line2: c.address_line2,
      city: c.city,
      state: c.state,
      postal_code: c.postal_code,
      latitude: c.latitude,
      longitude: c.longitude,

      data: c.data,
      header_block: c.header_block,
      footer_block: c.footer_block,
      services_jsonb: c.services_jsonb,

      owner_id: user.id,
      // published defaults false; do not send generated columns
    })
    .select('id, slug')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: v.id, slug: v.slug }, { status: 200 });
}
